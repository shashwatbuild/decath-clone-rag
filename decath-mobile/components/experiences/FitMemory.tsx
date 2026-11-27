"use client";
/* eslint-disable @next/next/no-img-element -- display unmodified public catalogue photographs */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FIT_PRODUCTS,
  fitEligible,
  fitInsight,
  type FitRecord,
  type FitValue,
} from "@/lib/experiences/model";
import { useExperiences } from "@/lib/experiences/store";
import { useStore } from "@/lib/store";
import { getProduct, img, inr } from "@/lib/products";
import { supportsFitting } from "@/lib/tryon/assets";
import ExperienceShell, { ToggleChips } from "./ExperienceShell";
const LABELS = { snug: "Too snug", right: "Just right", loose: "Too loose" };
export default function FitMemory() {
  const params = useSearchParams(),
    { data, ready, commit } = useExperiences(),
    { showToast } = useStore();
  const [query, setQuery] = useState(""),
    [productId, setProductId] = useState(
      FIT_PRODUCTS.find((p) => supportsFitting(p.id))?.id ?? FIT_PRODUCTS[0].id,
    ),
    [recordId, setRecordId] = useState(""),
    [size, setSize] = useState(""),
    [overall, setOverall] = useState<FitValue>("right"),
    [comfort, setComfort] = useState<FitRecord["comfort"]>("comfortable"),
    [areas, setAreas] = useState<string[]>([]),
    [note, setNote] = useState(""),
    [consent, setConsent] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    const id = params.get("product");
    if (id && fitEligible(id)) setProductId(id);
  }, [params]);
  const product = getProduct(productId)!,
    insight = fitInsight(productId, data.fits),
    matches = FIT_PRODUCTS.filter((p) =>
      `${p.shortName} ${p.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ).slice(0, 12);
  function reset(id: string) {
    setProductId(id);
    setSize("");
    setRecordId("");
    setAreas([]);
    setNote("");
    setOverall("right");
    setComfort("comfortable");
    setConsent(false);
    setSaved(false);
  }
  function edit(r: FitRecord) {
    setProductId(r.productId);
    setRecordId(r.id);
    setSize(r.size);
    setOverall(r.overall);
    setComfort(r.comfort);
    setAreas(r.areas);
    setNote(r.note);
    setConsent(false);
    setSaved(false);
  }
  function save() {
    if (!consent || !product.sizes.includes(size)) return;
    const entry: FitRecord = {
      id: recordId || crypto.randomUUID(),
      productId,
      size,
      overall,
      comfort,
      areas,
      note,
      updatedAt: new Date().toISOString(),
    };
    if (
      commit((c) => ({
        ...c,
        fits: [
          entry,
          ...c.fits.filter(
            (f) =>
              f.id !== entry.id &&
              !(f.productId === productId && f.size === size),
          ),
        ].slice(0, 50),
      }))
    ) {
      setRecordId(entry.id);
      setSaved(true);
      showToast("Fit memory saved on this device");
    }
  }
  return (
    <ExperienceShell
      active="/fit"
      title="My fit memories"
      lead="Remember the fit. Keep the feeling."
      description="Record how an item you have worn actually fits, then bring that memory back when you shop."
    >
      <div className="experience-layout fit-layout">
        <section className="experience-main experience-card">
          <div className="experience-section-heading">
            <h3>
              {recordId
                ? "Update your fit memory"
                : "Which item have you tried?"}
            </h3>
            <span className="experience-pill">Your feedback, your control</span>
          </div>
          <label className="lab-label">
            Find a catalogue item
            <input
              className="lab-input"
              placeholder="Search shoes, tops or yoga pants"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
            />
          </label>
          {query && (
            <div
              className="fit-search-results"
              role="group"
              aria-label="Matching catalogue items"
            >
              {matches.length ? (
                matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      reset(p.id);
                      setQuery("");
                    }}
                  >
                    {p.shortName}
                    <span>{p.category}</span>
                  </button>
                ))
              ) : (
                <p>No matching items in this catalogue.</p>
              )}
            </div>
          )}
          <div className="fit-product-stage">
            <div className="fit-product-image">
              <img src={img(product.images[0], 640)} alt={product.shortName} />
            </div>
            <div>
              <span className="experience-label">{product.category}</span>
              <h3>{product.shortName}</h3>
              <p>{inr(product.price)}</p>
              <Link
                href={`/p/${product.id}`}
                className="experience-text-button"
              >
                Product and size guide →
              </Link>
              {supportsFitting(product.id) && (
                <Link
                  className="lab-button mt-4"
                  href={`/try-on?product=${product.id}`}
                >
                  Open camera preview →
                </Link>
              )}
            </div>
          </div>
          <fieldset className="experience-fieldset">
            <legend>Size you actually wore</legend>
            <div
              className="fit-size-grid"
              role="group"
              aria-label="Size you wore"
            >
              {product.sizes.map((s) => (
                <button
                  key={s}
                  aria-pressed={size === s}
                  onClick={() => {
                    setSize(s);
                    setSaved(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="experience-fieldset">
            <legend>How did it fit overall?</legend>
            <div className="fit-feelings" role="group" aria-label="Overall fit">
              {(["snug", "right", "loose"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={overall === v}
                  onClick={() => {
                    setOverall(v);
                    setSaved(false);
                  }}
                >
                  <span
                    className={`fit-feeling-diagram fit-feeling-${v}`}
                    aria-hidden
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>{LABELS[v]}</strong>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="experience-fieldset">
            <legend>Could you move comfortably?</legend>
            <div
              className="experience-segmented"
              role="group"
              aria-label="Freedom of movement"
            >
              <button
                aria-pressed={comfort === "comfortable"}
                onClick={() => {
                  setComfort("comfortable");
                  setSaved(false);
                }}
              >
                Comfortable movement
              </button>
              <button
                aria-pressed={comfort === "restricted"}
                onClick={() => {
                  setComfort("restricted");
                  setSaved(false);
                }}
              >
                Felt restricted
              </button>
            </div>
          </fieldset>
          <fieldset className="experience-fieldset">
            <legend>
              Anywhere you would change?{" "}
              <span className="experience-muted">Optional</span>
            </legend>
            <ToggleChips
              options={
                /shoes|socks/i.test(product.category)
                  ? ["Feet", "Length"]
                  : ["Shoulders", "Chest", "Waist", "Length"]
              }
              value={areas}
              onChange={(a) => {
                setAreas(a);
                setSaved(false);
              }}
              label="Fit areas"
            />
          </fieldset>
          <label className="lab-label mt-5">
            A note for next time
            <textarea
              className="lab-input min-h-20"
              maxLength={200}
              placeholder="e.g. Comfortable standing, but tight across the shoulders when reaching."
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <label className="fit-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Save my fit feedback on this device. I can edit or remove it
              anytime.
            </span>
          </label>
          <div className="experience-actions">
            <button
              className="tool-primary"
              disabled={!ready || !consent || !product.sizes.includes(size)}
              onClick={save}
            >
              {saved
                ? "Fit memory saved ✓"
                : recordId
                  ? "Update fit memory"
                  : "Remember this fit"}
            </button>
            {recordId && (
              <button className="lab-button" onClick={() => reset(productId)}>
                Start a new memory
              </button>
            )}
          </div>
          <p className="experience-muted mt-4">
            A camera preview cannot confirm physical fit. This memory is your
            own experience, not a measurement or size guarantee.
          </p>
        </section>
        <aside className="experience-aside">
          <section className="experience-card fit-insight">
            <span className="experience-label">A useful starting point</span>
            <h3>
              {insight.size
                ? `Your remembered size: ${insight.size}`
                : "Every item fits differently."}
            </h3>
            <p>{insight.message}</p>
            <div className="fit-memory-visual" aria-hidden>
              <span>{insight.size || "You"}</span>
              <i />
              <span>{insight.size ? "✓" : "↔"}</span>
            </div>
            <p className="experience-muted">
              We only suggest a remembered size for the exact same catalogue
              item. Other products can fit differently.
            </p>
          </section>
          <section className="experience-card">
            <div className="experience-section-heading">
              <h3>Your fit wardrobe</h3>
              <span className="experience-pill">{data.fits.length}</span>
            </div>
            {data.fits.length ? (
              <div className="fit-wardrobe">
                {data.fits.map((r) => {
                  const p = getProduct(r.productId)!;
                  return (
                    <article key={r.id}>
                      <button
                        className="fit-memory-open"
                        onClick={() => edit(r)}
                      >
                        <img src={img(p.images[0], 160)} alt="" />
                        <span>
                          <strong>{p.shortName}</strong>
                          <small>
                            Size {r.size} · {LABELS[r.overall]}
                          </small>
                          <small>
                            {r.comfort === "comfortable"
                              ? "Comfortable movement"
                              : "Movement felt restricted"}
                          </small>
                        </span>
                      </button>
                      <div>
                        <button
                          className="experience-text-button"
                          onClick={() => edit(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="experience-text-button"
                          aria-label={`Remove fit memory for ${p.shortName}, size ${r.size}`}
                          onClick={() => {
                            if (
                              commit(
                                (c) => ({
                                  ...c,
                                  fits: c.fits.filter((f) => f.id !== r.id),
                                }),
                                true,
                              )
                            ) {
                              if (recordId === r.id) reset(productId);
                              showToast("Fit memory removed");
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="experience-empty">
                <span aria-hidden>↔</span>
                <h4>Your first fit memory starts here.</h4>
                <p>Choose an item and record a size you have actually worn.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </ExperienceShell>
  );
}
