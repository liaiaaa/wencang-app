import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Award, Scissors, Sparkles, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useGoBack from "@/hooks/use-go-back";
import { fetchArtisanById } from "@/lib/api";
import type { Artisan } from "@/types/types";

export default function ArtisanDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 返回展厅走历史后退，列表页才能恢复到离开前的浏览位置
  const goBackToList = useGoBack("/artisans");
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchArtisanById(id)
      .then(setArtisan)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <Skeleton className="mb-8 h-8 w-40 bg-muted" />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full rounded-lg bg-muted" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-40 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!artisan) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center md:px-8">
        <p className="text-muted-foreground">守艺人信息不存在</p>
        <Button variant="outline" className="mt-4" onClick={goBackToList}>
          返回展厅
        </Button>
      </div>
    );
  }

  const works = artisan.works ? artisan.works.split(/[、,，]/).filter(Boolean) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <Button
        variant="ghost"
        size="sm"
        onClick={goBackToList}
        className="mb-6 -ml-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回展厅
      </Button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-lg border border-border bg-muted"
        >
          <img src={artisan.image_url} alt={artisan.name} className="h-full w-full object-cover duotone-img" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <Badge variant="secondary" className="num-label">{artisan.craft}</Badge>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-serif-cn text-3xl font-bold leading-tight text-primary md:text-4xl">{artisan.name}</h1>
            <Badge variant="outline" className="num-label px-2 text-xs font-normal text-muted-foreground">
              示例档案
            </Badge>
          </div>
          <p className="mt-2 flex items-center gap-2 num-label text-sm text-accent">
            <Award className="h-4 w-4" />
            {artisan.title}
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="num-label text-xs text-muted-foreground">所属地区</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{artisan.region}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Scissors className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="num-label text-xs text-muted-foreground">擅长工艺</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{artisan.craft}</p>
              </div>
            </div>
          </div>

          {works.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">代表作品</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {works.map((w) => (
                  <Badge key={w} variant="outline" className="num-label text-xs">{w.trim()}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 hairline" />

          <div className="mt-6">
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">个人简介</p>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-foreground">{artisan.bio}</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
              本档案为平台示例数据，图片为示意用途
            </p>
          </div>

          <Button asChild className="mt-8">
            <Link to="/booking">预约体验</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}