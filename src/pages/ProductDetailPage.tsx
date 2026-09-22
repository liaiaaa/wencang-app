import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, ShoppingBag, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import useGoBack from "@/hooks/use-go-back";
import { fetchProductById, createOrder } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { Product } from "@/types/types";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 返回商城走历史后退，列表页才能恢复到离开前的浏览位置
  const goBackToList = useGoBack("/shop");
  const { session } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProductById(id)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [id]);

  const handleOrder = () => {
    if (!session) {
      navigate("/login", { state: { from: `/shop/${id}` } });
      return;
    }
    setDialogOpen(true);
  };

  const submitOrder = async () => {
    if (!contactName.trim() || !contactPhone.trim() || !address.trim()) {
      toast.error("请填写完整的收件信息");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(contactPhone.trim())) {
      toast.error("联系电话格式有误");
      return;
    }
    if (!product) return;
    setSubmitting(true);
    try {
      await createOrder({
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        address: address.trim(),
      });
      toast.success("下单成功，可在「我的订单」中查看");
      // 运营埋点：商城下单
      track("shop_order", { product: product.name, price: product.price });
      setDialogOpen(false);
      navigate("/profile?tab=orders");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "下单失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <Skeleton className="mb-8 h-8 w-40 bg-muted" />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg bg-muted" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48 bg-muted" />
            <Skeleton className="h-6 w-24 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center md:px-8">
        <p className="text-muted-foreground">商品不存在</p>
        <Button variant="outline" className="mt-4" onClick={goBackToList}>
          返回商城
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <Button
        variant="ghost"
        size="sm"
        onClick={goBackToList}
        className="mb-6 -ml-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回商城
      </Button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-lg border border-border bg-muted"
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover duotone-img" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-xs text-muted-foreground">
              暂无图片
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <h1 className="font-serif-cn text-2xl font-bold leading-tight text-primary md:text-3xl text-balance">{product.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-4 w-4 text-accent" />
            {product.artisan_id ? (
              <Link
                to={`/artisans/${product.artisan_id}`}
                className="text-primary transition-colors hover:underline"
              >
                出自 · {product.artisan_name}
              </Link>
            ) : (
              <>出自 · {product.artisan_name || "暂无关联守艺人"}</>
            )}
          </p>
          <p className="mt-6 num-label text-3xl font-bold text-accent">¥{product.price}</p>

          <div className="mt-8 hairline" />

          <div className="mt-6">
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">工艺说明</p>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-foreground">{product.craft_description}</p>
          </div>

          <Button onClick={handleOrder} className="mt-8 w-full md:w-auto" size="lg">
            <ShoppingBag className="mr-2 h-4 w-4" />
            {session ? "立即下单" : "登录后下单"}
          </Button>
          {!session && (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              下单需要先登录
            </p>
          )}
        </motion.div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif-cn text-primary">确认下单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-secondary/50 p-4">
              <p className="text-sm font-medium text-foreground">{product.name}</p>
              <p className="mt-1 num-label text-lg font-bold text-accent">¥{product.price}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">收件人</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="请输入收件人姓名" className="px-3" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">联系电话</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="请输入手机号" className="px-3" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">收件地址</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="请输入收件地址" className="px-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={submitOrder} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确认下单
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}