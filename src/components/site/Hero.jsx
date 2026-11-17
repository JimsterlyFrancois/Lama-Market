import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { HERO_BACKDROP, HERO_VISUAL } from "@/lib/catalog";

const heroCss = `
.hs13{position:relative;container:hs13/inline-size;overflow:hidden;isolation:isolate;background:hsl(var(--background));}
.hs13__inner{position:relative;display:grid;grid-template-areas:"text" "media";width:100%;}
.hs13__text{grid-area:text;padding:clamp(28px,6cqi,64px) clamp(20px,5cqi,64px);display:flex;flex-direction:column;gap:clamp(16px,2.4cqi,24px);z-index:2;}
.hs13__eyebrow{display:inline-flex;align-self:flex-start;align-items:center;gap:8px;margin:0;border-radius:999px;background:hsl(var(--primary)/0.07);padding:7px 14px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:hsl(var(--primary));}
.hs13__dot{width:6px;height:6px;border-radius:999px;background:hsl(var(--accent));}
.hs13__title{margin:0;max-width:22ch;font-family:var(--font-heading);font-weight:800;font-size:clamp(2rem,0.9rem + 5cqi,3.4rem);line-height:1.02;letter-spacing:-0.035em;color:hsl(var(--primary));}
.hs13__title em{font-style:normal;color:hsl(var(--accent));}
.hs13__body{margin:0;max-width:42ch;font-size:1.0625rem;line-height:1.65;color:hsl(var(--foreground)/0.7);}
.hs13__actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin-top:2px;}
.hs13__cta{display:inline-flex;align-items:center;gap:10px;border-radius:999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));padding:15px 24px;font-weight:600;font-size:0.9375rem;text-decoration:none;transition:background-color .25s ease,color .25s ease,transform .25s ease;}
.hs13__cta:hover{background:hsl(var(--accent));color:hsl(var(--accent-foreground));transform:translateY(-1px);}
.hs13__cta:focus-visible{outline:2px solid hsl(var(--primary));outline-offset:3px;}
.hs13__ghost{display:inline-flex;align-items:center;gap:8px;border-radius:999px;border:1px solid hsl(var(--primary)/0.22);color:hsl(var(--primary));padding:14px 22px;font-weight:600;font-size:0.9375rem;text-decoration:none;transition:background-color .25s ease,border-color .25s ease;}
.hs13__ghost:hover{background:hsl(var(--primary)/0.06);border-color:hsl(var(--primary)/0.4);}
.hs13__ghost:focus-visible{outline:2px solid hsl(var(--primary));outline-offset:3px;}
.hs13__media{grid-area:media;position:relative;overflow:hidden;min-height:clamp(300px,62cqi,440px);}
.hs13__track{position:absolute;inset:0;display:flex;width:400%;height:100%;will-change:transform;animation:hs13-drift 44s linear infinite;}
.hs13__cell{flex:1 1 0;height:100%;position:relative;overflow:hidden;}
.hs13__visual{position:absolute;z-index:2;right:clamp(16px,5cqi,40px);bottom:clamp(16px,5cqi,40px);display:block;width:clamp(150px,36cqi,250px);aspect-ratio:281/331;overflow:hidden;border-radius:20px;box-shadow:0 26px 50px -18px rgba(6,78,59,.5);}
@keyframes hs13-drift{from{transform:translate3d(0,0,0);}to{transform:translate3d(-25%,0,0);}}
@keyframes hs13-rise{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
.hs13__eyebrow,.hs13__title,.hs13__body,.hs13__actions,.hs13__visual{animation:hs13-rise .8s cubic-bezier(.22,1,.36,1) both;}
.hs13__eyebrow{animation-delay:.04s;}
.hs13__title{animation-delay:.1s;}
.hs13__body{animation-delay:.2s;}
.hs13__actions{animation-delay:.3s;}
.hs13__visual{animation-delay:.38s;}
@container hs13 (width >= 820px){
  .hs13__inner{grid-template-areas:"stage";min-height:min(58cqi,690px);}
  .hs13__media{grid-area:stage;margin-left:48cqi;min-height:0;}
  .hs13__text{grid-area:stage;position:relative;justify-content:center;max-width:46cqi;padding:clamp(36px,4cqi,64px);pointer-events:none;}
  .hs13__eyebrow,.hs13__title,.hs13__body,.hs13__actions{pointer-events:auto;}
  .hs13__title{max-width:calc(42cqi - 24px);font-size:clamp(2.25rem,9px + 4.6cqi,3.5rem);}
  .hs13__body{max-width:min(380px,calc(42cqi - 24px));}
  .hs13__visual{width:clamp(200px,26cqi,280px);}
}
@container hs13 (width <= 480px){
  .hs13__body{font-size:0.9375rem;line-height:1.6;}
}
@media (prefers-reduced-motion: reduce){
  .hs13__track{animation:none;}
  .hs13__eyebrow,.hs13__title,.hs13__body,.hs13__actions,.hs13__visual{animation:none;}
}
`;

export default function Hero() {
  return (
    <section className="hs13" aria-labelledby="hero-title">
      <style>{heroCss}</style>
      <div className="hs13__inner">
        <div className="hs13__media">
          <div className="hs13__track" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div className="hs13__cell" key={index}>
                <Image src={HERO_BACKDROP} alt="" className="h-full w-full" />
              </div>
            ))}
          </div>
          <Image
            src={HERO_VISUAL}
            alt="Panier de produits frais et objets pour la maison sélectionnés par Lama Market"
            className="hs13__visual"
            focalPointX={0.5}
            focalPointY={0.45}
          />
        </div>

        <div className="hs13__text">
          <p className="hs13__eyebrow">
            <span className="hs13__dot" aria-hidden="true" />
            Livraison en 24 h
          </p>
          <h1 className="hs13__title" id="hero-title">
            Tout ce dont vous avez besoin, livré chez vous <em>en un clic.</em>
          </h1>
          <p className="hs13__body">
            Découvrez des milliers de produits sélectionnés au meilleur prix sur Lama Market :
            épicerie locale, maison, beauté, high-tech et mode.
          </p>
          <div className="hs13__actions">
            <Link to="/boutique" className="hs13__cta">
              Explorer la boutique
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
            <Link to="/offres" className="hs13__ghost">
              Voir les offres du jour
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
