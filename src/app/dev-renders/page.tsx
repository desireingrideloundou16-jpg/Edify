import { notFound } from "next/navigation";
import { DevRenders } from "./DevRenders";

// Internal asset tool: only available with `npm run dev`.
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DevRenders />;
}
