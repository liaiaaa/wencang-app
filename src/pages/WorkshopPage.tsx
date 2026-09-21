import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Sparkles, Loader2, Save, RefreshCw, Lock, Wand2, Info } from "lucide-react";
import PageHero from "@/components/common/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { generatePatternImage, uploadAiPatternImage, saveAiPattern } from "@/lib/api";
import { track } from "@/lib/analytics";
import {
  buildPrompt,
  generateNameAndMeaning,
  generatePatternArt,
  rasterizeSvg,
  MOTIF_LABELS,
  LAYOUT_LABELS,
  type PatternArt,
} from "@/lib/patternGen";
import type { PatternCategory } from "@/types/types";
import { cn } from "@/lib/utils";

const categories: PatternCategory[] = ["蜡染", "扎染", "苗绣"];
const examples = ["蝴蝶妈妈 苗绣", "铜鼓纹 蜡染", "云纹 扎染", "百鸟朝凤 苗绣"];

/** 生成结果：云端生图，或本地程序化生成 */
type GenResult =
  | { kind: "cloud"; imageUrl: string }
  | { kind: "local"; art: PatternArt };

export default function WorkshopPage() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState("");
  const [category, setCategory] = useState<PatternCategory>("苗绣");
  const [result, setResult] = useState<GenResult | null>(null);
  const [name, setName] = useState("");
  const [meaning, setMeaning] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  // 变体号：同一主题词下递增即可得到新变体（「重新生成」）
  const [variant, setVariant] = useState(0);

  const base64ToBlob = (b64: string): Blob => {
    const byteChars = atob(b64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  };

  /**
   * 生成纹样。
   * 优先调用云端生图服务；不可用时自动落到本地程序化生成，
   * 因此断网/无额度场景下依然能出图。
   */
  const handleGenerate = useCallback(
    async (opts?: { nextVariant?: boolean }) => {
      const text = theme.trim();
      if (!text) {
        toast.error("请输入主题词");
        return;
      }
      const v = opts?.nextVariant ? variant + 1 : variant;
      if (opts?.nextVariant) setVariant(v);

      setGenerating(true);
      setResult(null);

      const naming = generateNameAndMeaning(text, category);
      setName(naming.name);
      setMeaning(naming.meaning);

      try {
        // 1) 首选：云端 Edge Function 生图
        try {
          const prompt = buildPrompt(text, category);
          const b64 = await generatePatternImage(prompt, "1024x1024");
          const url = URL.createObjectURL(base64ToBlob(b64));
          setResult({ kind: "cloud", imageUrl: url });
          toast.success("纹样生成完成");
          return;
        } catch {
          // 云端不可用（无额度 / 断网 / 未配置），继续走本地程序化生成
        }

        // 2) 兜底：本地程序化生成（纯前端，离线可用）
        const art = generatePatternArt(text, category, v);
        setResult({ kind: "local", art });
        // 运营埋点：纹样生成（含主题词 / 基元 / 种子，后台趋势与复盘用）
        track("workshop_generate", {
          theme: text,
          category,
          motif: art.primary,
          secondary: art.secondary ?? "",
          layout: art.layout,
          seed: art.seedLabel,
        });
        toast.info("演示模式：生图服务暂不可用，已切换为本地程序化生成");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "纹样生成失败");
      } finally {
        setGenerating(false);
      }
    },
    [theme, category, variant],
  );

  const handleSave = async () => {
    if (!session) {
      navigate("/login", { state: { from: "/workshop" } });
      return;
    }
    if (!user || !result || !name) return;
    setSaving(true);
    try {
      let blob: Blob;
      if (result.kind === "cloud") {
        blob = await (await fetch(result.imageUrl)).blob();
      } else {
        // 本地生成的 SVG 先光栅化为 PNG 再上传
        blob = await rasterizeSvg(result.art.svg);
      }
      const url = await uploadAiPatternImage(blob, user.id);
      await saveAiPattern({ theme: theme.trim(), category, image_url: url, name, meaning });
      toast.success("已保存到「我的纹样」");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const art = result?.kind === "local" ? result.art : null;
  const imageUrl = result?.kind === "cloud" ? result.imageUrl : null;
  const hasResult = result !== null;

  return (
    <div>
      <PageHero
        eyebrow="AI Pattern Studio"
        title="AI纹样工坊"
        subtitle="输入主题词并选择类别，AI 将续写生成一幅全新的非遗风格纹样，并为你解读其命名与寓意。"
      />

      <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-12">
        {/* 生成模式说明：诚实标注当前使用的生成方式 */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="num-label gap-1 px-2 text-xs font-normal text-muted-foreground">
            <Wand2 className="h-3 w-3" />
            本地程序化生成模式
          </Badge>
          <span className="text-xs text-muted-foreground">
            云端生图可用时优先调用云端，不可用时由本地算法即时生成
          </span>
        </div>

        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          {/* Input panel */}
          <div className="space-y-6 rounded-lg border border-border bg-card p-6">
            <div>
              <Label className="num-label text-xs font-semibold uppercase tracking-wider text-accent">主题词</Label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例如：蝴蝶妈妈 苗绣"
                className="mt-3 px-3"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setTheme(ex)}
                    className="num-label rounded-md border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="num-label text-xs font-semibold uppercase tracking-wider text-accent">纹样类别</Label>
              <div className="mt-3 flex gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "num-label flex-1 rounded-md border px-4 py-2.5 text-sm transition-colors",
                      category === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => handleGenerate()} className="w-full" size="lg" disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在生成…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  生成纹样
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              云端生图约需 10–30 秒；本地程序化生成为即时完成
            </p>
          </div>

          {/* Result panel */}
          <div className="space-y-6 rounded-lg border border-border bg-card p-6">
            <div className="aspect-square w-full overflow-hidden rounded-md bg-muted">
              {generating ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="num-label text-sm text-muted-foreground">AI 正在创作纹样…</p>
                </div>
              ) : imageUrl ? (
                <motion.img
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  src={imageUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : art ? (
                <motion.img
                  key={art.seed}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  src={art.dataUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">输入主题词后，生成的纹样将显示在这里</p>
                </div>
              )}
            </div>

            {hasResult && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="num-label">{category}</Badge>
                  <span className="num-label text-xs text-muted-foreground">
                    {art ? "程序化生成" : "AI 生成"}
                  </span>
                  {art && (
                    <>
                      <span className="num-label text-xs text-muted-foreground">
                        {MOTIF_LABELS[art.primary]}
                        {art.secondary ? ` + ${MOTIF_LABELS[art.secondary]}` : ""}
                      </span>
                      <span className="num-label text-xs text-muted-foreground">
                        {LAYOUT_LABELS[art.layout]}
                      </span>
                    </>
                  )}
                </div>

                {art && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-secondary/50 p-3">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      生图服务暂不可用，已由本地算法即时生成 ·
                      <span className="num-label"> 算法生成 · 种子{art.seedLabel}</span>
                    </p>
                  </div>
                )}

                <h3 className="mt-3 font-serif-cn text-xl font-bold text-primary">{name}</h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{meaning}</p>

                <div className="mt-5 flex gap-3">
                  <Button onClick={handleSave} className="flex-1" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {session ? "保存到我的纹样" : "登录后保存"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleGenerate({ nextVariant: true })}
                    disabled={generating}
                    title="生成新变体"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {!session && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    保存纹样需要先
                    <Link to="/login" state={{ from: "/workshop" }} className="font-medium text-primary hover:underline">
                      登录
                    </Link>
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}