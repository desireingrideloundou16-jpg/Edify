"""
Edify AI Engine - Self-hosted Packaging Texture Generation
Stable Diffusion 1.5 + ControlNet Lineart for Dieline-constrained Packaging Textures

EXPERIMENTAL - NOT DEPLOYED. See README.md before running it anywhere.
Safety locks: refuses to start without EDIFY_AI_ENGINE_TOKEN, listens on localhost only by
default, CORS closed unless EDIFY_AI_ENGINE_ORIGINS is set, bounded image sizes, generic errors.
"""
import io
import os
import sys
import hmac
import base64
import torch
import numpy as np
from PIL import Image, ImageOps
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── Safety locks (no accidental public exposure) ──────────────────────────────
ENGINE_TOKEN = os.environ.get("EDIFY_AI_ENGINE_TOKEN", "").strip()
if len(ENGINE_TOKEN) < 32:
    sys.exit("[x] EDIFY_AI_ENGINE_TOKEN manquant ou trop court (32 caracteres min.) : le moteur refuse de demarrer.")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("EDIFY_AI_ENGINE_ORIGINS", "").split(",") if o.strip()]
HOST = os.environ.get("EDIFY_AI_ENGINE_HOST", "127.0.0.1")


def require_token(authorization: Optional[str] = Header(default=None)) -> None:
    """Bearer token, compared in constant time."""
    expected = f"Bearer {ENGINE_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Non autorise.")
from diffusers import (
    StableDiffusionControlNetPipeline,
    ControlNetModel,
    UniPCMultistepScheduler,
)

app = FastAPI(
    title="Edify Packaging AI Engine",
    description="Pipeline autonome Stable Diffusion + ControlNet pour textures packaging 3D",
    version="1.0.0",
)

# Server-to-server use only: no browser origin is allowed unless explicitly listed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

CONTROLNET_MODEL_ID = "lllyasviel/control_v11p_sd15_lineart"
BASE_MODEL_ID = "runwayml/stable-diffusion-v1-5"

print(f"[*] Initialisation Edify AI Engine sur device: {DEVICE} ({DTYPE})")

try:
    controlnet = ControlNetModel.from_pretrained(
        CONTROLNET_MODEL_ID,
        torch_dtype=DTYPE,
    )
    pipe = StableDiffusionControlNetPipeline.from_pretrained(
        BASE_MODEL_ID,
        controlnet=controlnet,
        torch_dtype=DTYPE,
        safety_checker=None,
    )
    pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)

    if DEVICE == "cuda":
        pipe.enable_model_cpu_offload()
        try:
            pipe.enable_xformers_memory_efficient_attention()
        except Exception:
            pipe.enable_attention_slicing(slice_size="auto")
    else:
        pipe.to("cpu")
    print("[✓] Pipeline IA charge avec succes.")
except Exception as e:
    print(f"[!] Avertissement chargement pipeline local (mode lazy): {e}")
    pipe = None


class GenerateTextureRequest(BaseModel):
    prompt: str = Field(
        ...,
        max_length=1000,
        example="luxury minimalist organic cosmetic box, matte forest green, elegant gold foil typography, clean botanic illustration, 8k product packaging, photorealistic",
    )
    negative_prompt: Optional[str] = Field(
        default="blurry, distorted text, low quality, artifact, seam errors, overexposed, noise, gradient banding",
    )
    dieline_base64: Optional[str] = Field(
        default=None,
        description="Image base64 du gabarit de decoupe (dieline).",
    )
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)
    controlnet_conditioning_scale: float = Field(default=1.0, ge=0.0, le=2.0)
    num_inference_steps: int = Field(default=25, ge=15, le=50)
    seed: Optional[int] = Field(default=None)
    width: int = Field(default=1024, ge=256, le=1024, multiple_of=8)
    height: int = Field(default=1024, ge=256, le=1024, multiple_of=8)


class GenerateTextureResponse(BaseModel):
    texture_base64: str
    width: int
    height: int
    seed: int


def create_default_box_dieline(width: int = 1024, height: int = 1024) -> Image.Image:
    dieline = np.zeros((height, width, 3), dtype=np.uint8)
    dieline[100:924, 150:153] = 255
    dieline[100:924, 450:453] = 255
    dieline[100:924, 750:753] = 255
    dieline[100:924, 874:877] = 255
    dieline[100:103, 150:877] = 255
    dieline[921:924, 150:877] = 255
    dieline[350:353, 150:877] = 180
    dieline[670:673, 150:877] = 180
    return Image.fromarray(dieline)


def process_dieline_input(dieline_base64: Optional[str], width: int, height: int) -> Image.Image:
    if not dieline_base64:
        return create_default_box_dieline(width, height)
    try:
        if "," in dieline_base64:
            dieline_base64 = dieline_base64.split(",")[1]
        image_bytes = base64.b64decode(dieline_base64)
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
        image = image.resize((width, height), Image.Resampling.LANCZOS)
        np_img = np.array(image)
        if np.mean(np_img) > 127:
            image = ImageOps.invert(image)
        return image.convert("RGB")
    except Exception as e:
        print(f"[!] dieline invalide: {e}")
        raise HTTPException(status_code=400, detail="Gabarit de decoupe invalide.")


@app.get("/health")
def health():
    # Public liveness only: no machine details.
    return {"status": "online" if pipe is not None else "degraded"}


@app.post("/api/v1/generate-texture", response_model=GenerateTextureResponse, dependencies=[Depends(require_token)])
def generate_texture(req: GenerateTextureRequest):
    if pipe is None:
        raise HTTPException(status_code=503, detail="Pipeline IA non initialise sur ce serveur.")
    try:
        control_image = process_dieline_input(req.dieline_base64, req.width, req.height)
        generator_seed = req.seed if req.seed is not None else int(torch.randint(0, 2**32 - 1, (1,)).item())
        generator = torch.Generator(device=DEVICE).manual_seed(generator_seed)

        result = pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            image=control_image,
            num_inference_steps=req.num_inference_steps,
            guidance_scale=req.guidance_scale,
            controlnet_conditioning_scale=req.controlnet_conditioning_scale,
            generator=generator,
            width=req.width,
            height=req.height,
        )

        output_image: Image.Image = result.images[0]
        buffered = io.BytesIO()
        output_image.save(buffered, format="PNG", optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return GenerateTextureResponse(
            texture_base64=f"data:image/png;base64,{img_str}",
            width=req.width,
            height=req.height,
            seed=generator_seed,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[!] inference: {e}")
        raise HTTPException(status_code=500, detail="Erreur de generation.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=int(os.environ.get("EDIFY_AI_ENGINE_PORT", "8000")), reload=False)
