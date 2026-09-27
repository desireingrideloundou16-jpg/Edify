import React from "react";
import { BriefBox, HeroCluster, LandingNav, PackRender } from "./LandingClient";
import { HeroParallax, LiveDemo, PackMarquee, ScrollStory } from "./LandingRich";
import { DemoVideo } from "./DemoVideo";
import { SHOWCASE } from "./showcase";

const CATEGORIES = ["Cosmétique", "Café", "Bière", "Miel", "Chocolat", "Thé", "Snacks", "Vin", "Bougies", "Compléments", "Épicerie fine", "Boissons"];

const FAQ = [
  {
    q: "Faut-il savoir dessiner ou utiliser un logiciel de design ?",
    a: "Non. Vous décrivez votre produit en une phrase, l'IA choisit le contenant, les couleurs, les polices et rédige les textes. Vous pouvez ensuite tout modifier en quelques clics, sans aucune compétence en design.",
  },
  {
    q: "Quels types de packaging puis-je créer ?",
    a: "Boîtes pliantes, coffrets, doypacks, sachets, flacons, bouteilles, pots, tubes, canettes, boîtes métal, briques alimentaires… près de 100 formats d'emballage, pour la cosmétique, l'alimentaire, les boissons et l'épicerie fine.",
  },
  {
    q: "Le fichier est-il vraiment prêt pour l'imprimeur ?",
    a: "Edify génère un PDF avec fonds perdus de 3 mm, traits de coupe et tracé de découpe sur une page séparée. Comme pour tout fichier d'impression, votre imprimeur réalise la conversion CMJN et vous envoie un BAT à valider avant production.",
  },
  {
    q: "Puis-je utiliser mon propre logo ?",
    a: "Oui. Importez votre logo (PNG, SVG ou JPG) : il est placé automatiquement sur la face avant, dans l'aperçu 3D, le PDF et les visuels publicitaires.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Vous commencez gratuitement avec 10 crédits. Une génération par l'IA utilise un crédit ; les retouches, l'aperçu 3D et les téléchargements ne consomment pas de crédit.",
  },
  {
    q: "Qui possède les designs créés ?",
    a: "Vous. Les packagings que vous créez avec Edify vous appartiennent et peuvent être imprimés et commercialisés. Les polices proposées sont sous licence libre, utilisables commercialement.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Edify",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  description:
    "Edify conçoit votre packaging avec l'IA : forme, design, textes, maquette 3D et PDF prêt pour l'impression, en quelques minutes et sans compétence en design.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "10 crédits offerts pour commencer" },
  inLanguage: "fr",
};

function CropMarks() {
  return (
    <>
      <span className="lp-crop lp-crop-tl" aria-hidden="true" />
      <span className="lp-crop lp-crop-tr" aria-hidden="true" />
      <span className="lp-crop lp-crop-bl" aria-hidden="true" />
      <span className="lp-crop lp-crop-br" aria-hidden="true" />
    </>
  );
}

function ColorBar() {
  return (
    <div className="lp-colorbar" aria-hidden="true">
      <span style={{ background: "var(--c)" }} />
      <span style={{ background: "var(--m)" }} />
      <span style={{ background: "var(--y)" }} />
      <span style={{ background: "var(--k)" }} />
    </div>
  );
}

function DielineArt() {
  return (
    <svg viewBox="0 0 320 220" className="lp-dieline" role="img" aria-label="Tracé de découpe d'une boîte pliante">
      <g fill="none" strokeLinejoin="round">
        <path
          d="M40 70 L40 40 L46 22 L98 22 L104 40 L104 70 L108 50 L140 50 L148 62 L148 70 L212 70 L216 50 L248 50 L256 62 L256 70 L256 170 L256 178 L248 190 L216 190 L212 170 L212 202 L206 214 L154 214 L148 202 L148 170 L148 178 L140 190 L108 190 L104 170 L40 170 L28 166 L28 74 Z"
          stroke="var(--m)"
          strokeWidth="1.6"
        />
        <g stroke="var(--c)" strokeWidth="1.2" strokeDasharray="4 3">
          <path d="M40 70 L40 170 M104 70 L104 170 M148 70 L148 170 M212 70 L212 170" />
          <path d="M40 70 L104 70 M40 40 L104 40 M104 70 L148 70 M212 70 L256 70 M148 170 L212 170 M104 170 L148 170 M212 170 L256 170" />
        </g>
      </g>
      <rect x="152" y="80" width="56" height="80" rx="3" fill="var(--m)" opacity="0.12" />
      <text x="180" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--k)" fontFamily="Syne, sans-serif">Face</text>
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="lp" id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <a href="#contenu" className="lp-skip">Aller au contenu</a>
      <LandingNav />

      <main id="contenu">
        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-sheet">
            <CropMarks />
            <div className="lp-hero-copy">
              <p className="lp-kicker">
                <span className="lp-dot" aria-hidden="true" /> Designer de packaging propulsé par l&apos;IA
                <span className="lp-theme-chip" data-theme-label aria-live="polite" />
              </p>
              <h1 className="lp-h1">
                Décrivez votre produit.
                <br />
                Recevez son packaging prêt à imprimer.
              </h1>
              <p className="lp-lead">
                Edify conçoit votre emballage avec l&apos;IA&nbsp;: la forme, le design, les textes, la maquette 3D et le fichier PDF pour
                l&apos;imprimeur. En quelques minutes, sans graphiste ni logiciel.
              </p>
              <BriefBox />
              <p className="lp-micro">Gratuit pour commencer, 10 crédits offerts. Aucune carte bancaire.</p>
            </div>
            <HeroParallax>
              <HeroCluster />
            </HeroParallax>
          </div>
          <div className="lp-wrap">
            <ColorBar />
            <ul className="lp-stats">
              <li><strong>97</strong> formes d&apos;emballage</li>
              <li><strong>84</strong> styles visuels</li>
              <li><strong>58</strong> polices libres de droits</li>
              <li><strong>300 dpi</strong> PDF prêt à imprimer</li>
            </ul>
          </div>
        </section>

        {/* ── Demo film ── */}
        <section className="lp-section lp-video-sec" id="demo" aria-labelledby="video-title">
          <div className="lp-wrap">
            <h2 id="video-title" className="lp-h2">Edify en action, en 34 secondes</h2>
            <p className="lp-sub">Une phrase, un packaging complet, un fichier prêt pour l&apos;imprimeur et des visuels pour le lancer.</p>
            <DemoVideo />
          </div>
        </section>

        {/* ── Every category ── */}
        <section className="lp-section lp-cats" aria-labelledby="cats-title">
          <div className="lp-wrap">
            <h2 id="cats-title" className="lp-h2">Un seul outil pour tous vos emballages</h2>
            <p className="lp-cats-list">
              {CATEGORIES.map((c, i) => (
                <span key={c} className={`lp-cat lp-cat-${i % 4}`}>
                  {c}
                </span>
              ))}
            </p>
          </div>
          <PackMarquee />
        </section>

        {/* ── Live demo ── */}
        <section className="lp-section lp-demo-sec" aria-labelledby="demo-title">
          <div className="lp-wrap">
            <h2 id="demo-title" className="lp-h2">Regardez l&apos;IA concevoir un packaging</h2>
            <p className="lp-sub">Un brief, quelques secondes, et toutes les décisions d&apos;un directeur artistique : contenant, couleurs, typographies, finition.</p>
            <LiveDemo />
          </div>
        </section>

        {/* ── Scroll story (a real sequence) ── */}
        <section className="lp-section" id="comment" aria-labelledby="how-title">
          <div className="lp-wrap">
            <h2 id="how-title" className="lp-h2">De la phrase au fichier d&apos;impression</h2>
            <p className="lp-sub">Le même produit, suivi pas à pas. Chaque image ci-dessous est produite par Edify.</p>
            <ScrollStory />
          </div>
        </section>

        {/* ── The real studio ── */}
        <section className="lp-section lp-studio-sec" aria-labelledby="studio-title">
          <div className="lp-wrap">
            <h2 id="studio-title" className="lp-h2">Un studio pensé pour ceux qui ne sont pas designers</h2>
            <p className="lp-sub">Choisissez un contenant, un style, une police : tout se met à jour en même temps sur le patron à plat et sur la maquette 3D.</p>
            <figure className="lp-browser">
              <div className="lp-browser-bar" aria-hidden="true"><span /><span /><span /><p>Edify · Studio</p></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/studio.png" alt="Le studio Edify : catalogue de contenants, patron à plat et aperçu 3D" loading="lazy" />
            </figure>
            <ul className="lp-callouts">
              <li><strong>Trois onglets</strong> Le contenant, le style, puis vos textes et votre logo. Rien de plus.</li>
              <li><strong>Un grand aperçu</strong> Le patron à plat en direct, et la vue 3D en un clic.</li>
              <li><strong>Un seul bouton</strong> « Télécharger » : PDF d&apos;impression, visuel publicitaire, 3D, lien de partage.</li>
            </ul>
          </div>
        </section>

        {/* ── Capabilities (varied tiles, real renders) ── */}
        <section className="lp-section lp-features" id="fonctionnalites" aria-labelledby="feat-title">
          <div className="lp-wrap">
            <h2 id="feat-title" className="lp-h2">Tout ce qu&apos;un studio de design vous livrerait</h2>
            <div className="lp-bento">
              <article className="lp-tile lp-tile-3d">
                <div>
                  <h3>Maquette 3D réaliste</h3>
                  <p>Tournez votre packaging, changez l&apos;éclairage, regardez-le sous tous les angles, même par-dessous.</p>
                </div>
                <PackRender index={6} size={520} yaw={-0.35} alt="Bouteille de vin en 3D" className="lp-tile-pack" />
              </article>
              <article className="lp-tile lp-tile-print">
                <h3>PDF prêt pour l&apos;imprimeur</h3>
                <p>Fonds perdus de 3&nbsp;mm, traits de coupe et tracé de découpe vectoriel sur une page séparée.</p>
                <DielineArt />
              </article>
              <article className="lp-tile lp-tile-ai">
                <h3>Un directeur artistique IA</h3>
                <p>Il respecte les codes de votre catégorie, choisit des couleurs lisibles et rédige les mentions attendues au dos.</p>
                <dl className="lp-ai-sheet">
                  <div><dt>Brief</dt><dd>« Café bio en grains, esprit artisanal »</dd></div>
                  <div><dt>Contenant</dt><dd>Sachet café à valve, 250 g</dd></div>
                  <div><dt>Couleurs</dt><dd className="lp-ai-swatches"><span style={{ background: "#1E1A17" }} /><span style={{ background: "#F1E6D6" }} /><span style={{ background: "#C47A3D" }} /></dd></div>
                  <div><dt>Polices</dt><dd>Fraunces et DM Sans</dd></div>
                </dl>
              </article>
              <article className="lp-tile lp-tile-ad">
                <div className="lp-ad-stage">
                  <PackRender index={0} size={420} yaw={-0.3} alt="Canette mise en scène pour une publicité" />
                </div>
                <h3>Visuels publicitaires</h3>
                <p>Votre produit mis en scène en studio, aux formats Instagram, story et bannière.</p>
              </article>
              <article className="lp-tile lp-tile-numbers">
                <p className="lp-number"><strong>97</strong> formes d&apos;emballage</p>
                <p className="lp-number"><strong>84</strong> styles visuels</p>
                <p className="lp-number"><strong>58</strong> polices libres de droits</p>
              </article>
              <article className="lp-tile lp-tile-ar">
                <h3>Réalité augmentée</h3>
                <p>Posez votre packaging à taille réelle sur votre table, depuis votre téléphone, avant de l&apos;imprimer.</p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Gallery: one sentence, one pack ── */}
        <section className="lp-section" id="exemples" aria-labelledby="ex-title">
          <div className="lp-wrap">
            <h2 id="ex-title" className="lp-h2">Une phrase, un packaging</h2>
            <p className="lp-sub">Chaque exemple ci-dessous est rendu en direct par le moteur 3D d&apos;Edify, à partir de la phrase affichée.</p>
            <div className="lp-gallery">
              {SHOWCASE.slice(0, 8).map((item, i) => (
                <figure key={item.shapeId} className="lp-card">
                  <div className="lp-card-stage" style={{ background: item.design.palette[3] + "33" }}>
                    <PackRender index={i} size={420} yaw={-0.5} alt={`Packaging ${item.design.brandName}`} />
                  </div>
                  <figcaption>« {item.prompt} »</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison ── */}
        <section className="lp-section lp-compare-sec" aria-labelledby="cmp-title">
          <div className="lp-wrap">
            <h2 id="cmp-title" className="lp-h2">Le résultat d&apos;une agence, sans le délai ni le budget</h2>
            <div className="lp-compare" role="table" aria-label="Comparaison agence et Edify">
              <div className="lp-compare-row lp-compare-head" role="row">
                <span role="columnheader" />
                <span role="columnheader">Avec une agence</span>
                <span role="columnheader">Avec Edify</span>
              </div>
              {[
                ["Délai", "Plusieurs semaines", "Quelques minutes"],
                ["Budget", "Plusieurs milliers d'euros", "Gratuit pour commencer"],
                ["Point de départ", "Brief écrit, réunions", "Une phrase"],
                ["Modifications", "Allers-retours par e-mail", "En direct, autant que vous voulez"],
                ["Livrables", "En fin de projet", "PDF, 3D et visuels à tout moment"],
              ].map(([label, a, b]) => (
                <div key={label} className="lp-compare-row" role="row">
                  <span role="rowheader">{label}</span>
                  <span role="cell">{a}</span>
                  <span role="cell" className="lp-compare-us">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Audience ── */}
        <section className="lp-section" aria-labelledby="who-title">
          <div className="lp-wrap lp-who">
            <h2 id="who-title" className="lp-h2">Pensé pour ceux qui lancent des produits</h2>
            <ul className="lp-who-list">
              <li><strong>Créateurs de marque</strong> qui veulent un premier packaging professionnel sans budget d&apos;agence.</li>
              <li><strong>Artisans et producteurs</strong> qui vendent en épicerie, sur les marchés ou en ligne.</li>
              <li><strong>PME et e-commerçants</strong> qui déclinent de nouvelles références rapidement.</li>
              <li><strong>Agences et freelances</strong> qui veulent présenter des pistes créatives en quelques minutes.</li>
            </ul>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="lp-section" id="faq" aria-labelledby="faq-title">
          <div className="lp-wrap lp-faq-wrap">
            <h2 id="faq-title" className="lp-h2">Questions fréquentes</h2>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lp-final" aria-labelledby="final-title">
          <div className="lp-wrap">
            <h2 id="final-title" className="lp-final-title">Votre prochain packaging commence par une phrase.</h2>
            <BriefBox variant="final" />
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <a href="#top" className="lp-logo">
            <span className="lp-logo-badge">E</span>
            <span>Edify</span>
          </a>
          <nav aria-label="Pied de page" className="lp-footer-links">
            <a href="/create">Studio</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#exemples">Exemples</a>
            <a href="#faq">Questions</a>
          </nav>
          <p className="lp-footer-note">© 2026 Edify. Conçu pour les marques qui impriment.</p>
        </div>
      </footer>
    </div>
  );
}
