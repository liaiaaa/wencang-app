import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  Pencil,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { uploadContentImage } from "@/lib/api";
import type { ContentStatus } from "@/types/types";
import { cn } from "@/lib/utils";

/* ============================================================
 * 通用内容管理组件
 *
 * 纹样 / 守艺人 / 商品三者的"列表 + 新建 + 编辑 + 归档"交互完全同构，
 * 差异只在字段定义。这里用一份实现 + 三份字段配置（见 AdminDashboardPage），
 * 避免三套近乎重复的 CRUD 代码。
 * ============================================================ */

export interface FieldDef {
  key: string;
  label: string;
  /**
   * 字段类型：
   *  - list        多行文本，每行一条，存为 string[]
   *  - multiselect 多选（值为 id 列表，选项来自 options）
   */
  type: "text" | "textarea" | "number" | "select" | "image" | "list" | "multiselect";
  options?: readonly string[];
  /** select / multiselect 的 value→label 映射；缺省时直接显示 value */
  optionLabels?: Record<string, string>;
  required?: boolean;
  /** select 字段默认不选中任何项（新建时留空），而非取第一项 */
  allowEmpty?: boolean;
  placeholder?: string;
  /** 占据整行 */
  full?: boolean;
  /** 字段说明（显示在控件下方） */
  hint?: string;
}

export interface AdminEntity {
  id: string;
  name: string;
  status?: ContentStatus;
}

type FormValues = Record<string, string>;

interface EntityManagerProps<T extends AdminEntity, TPayload> {
  /** 区块标题，如「纹样管理」 */
  title: string;
  /** 单条记录的称呼，如「纹样」 */
  noun: string;
  fields: readonly FieldDef[];
  items: T[];
  loading: boolean;
  reload: () => void;
  create: (input: TPayload) => Promise<unknown>;
  update: (id: string, patch: Partial<TPayload>) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  restore: (id: string) => Promise<unknown>;
  /** 参与关键字搜索的字段 */
  searchKeys: readonly string[];
  /** 列表项上额外展示的元信息（类别、价格等） */
  renderMeta?: (item: T) => ReactNode;
  /** 列表项缩略图地址 */
  renderThumb?: (item: T) => string | undefined;
}

const emptyForm = (fields: readonly FieldDef[]): FormValues =>
  Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === "select" && !f.allowEmpty ? String(f.options?.[0] ?? "") : "",
    ]),
  );

/** 数组字段在表单里以「每行一条」的文本呈现 */
const LIST_SEPARATOR = "\n";
/** multiselect 在表单里以内部约定的分隔符串联 */
const MS_SEPARATOR = "\u0001";

const toListText = (v: unknown): string => (Array.isArray(v) ? v.join(LIST_SEPARATOR) : "");
const toMsValue = (v: unknown): string => (Array.isArray(v) ? v.join(MS_SEPARATOR) : "");

/** 把表单值转成提交给数据层的对象（数字字段转 number，列表字段转数组） */
function toPayload<TPayload>(fields: readonly FieldDef[], values: FormValues): TPayload {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.key] ?? "";
    if (f.type === "number") {
      out[f.key] = Number(raw || 0);
    } else if (f.type === "list") {
      out[f.key] = raw
        .split(LIST_SEPARATOR)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (f.type === "multiselect") {
      out[f.key] = raw ? raw.split(MS_SEPARATOR).filter(Boolean) : [];
    } else {
      out[f.key] = raw;
    }
  }
  return out as TPayload;
}

/** 把已有记录回填为表单值 */
function toForm(fields: readonly FieldDef[], item: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = item[f.key];
    if (f.type === "list") {
      out[f.key] = toListText(v);
    } else if (f.type === "multiselect") {
      out[f.key] = toMsValue(v);
    } else {
      out[f.key] = v === null || v === undefined ? "" : String(v);
    }
  }
  return out;
}

export default function EntityManager<T extends AdminEntity, TPayload>({
  title,
  noun,
  fields,
  items,
  loading,
  reload,
  create,
  update,
  archive,
  restore,
  searchKeys,
  renderMeta,
  renderThumb,
}: EntityManagerProps<T, TPayload>) {
  const [keyword, setKeyword] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<FormValues>(() => emptyForm(fields));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((item) =>
      searchKeys.some((k) => String((item as Record<string, unknown>)[k] ?? "").toLowerCase().includes(kw)),
    );
  }, [items, keyword, searchKeys]);

  const openCreate = () => {
    setEditing(null);
    setValues(emptyForm(fields));
    setDialogOpen(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setValues(toForm(fields, item as unknown as Record<string, unknown>));
    setDialogOpen(true);
  };

  const handleUpload = async (key: string, file: File) => {
    setUploading(true);
    try {
      const url = await uploadContentImage(file, "admin");
      setValues((prev) => ({ ...prev, [key]: url }));
      toast.success("图片已上传");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        toast.error(`请填写${f.label}`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = toPayload<TPayload>(fields, values);
      if (editing) {
        await update(editing.id, payload);
        toast.success(`${noun}已更新`);
      } else {
        await create(payload);
        toast.success(`${noun}已创建`);
      }
      setDialogOpen(false);
      reload();
    } catch (err) {
      const e = err as Error & { code?: string };
      toast.error(e.code === "403" ? "仅管理员可执行该操作" : e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (item: T) => {
    const isArchived = item.status === "archived";
    setBusyId(item.id);
    try {
      if (isArchived) {
        await restore(item.id);
        toast.success(`${noun}已恢复`);
      } else {
        await archive(item.id);
        toast.success(`${noun}已归档`);
      }
      reload();
    } catch (err) {
      const e = err as Error & { code?: string };
      toast.error(e.code === "403" ? "仅管理员可执行该操作" : e.message || "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const liveCount = items.filter((i) => i.status !== "archived").length;

  return (
    <div className="space-y-5">
      {/* 工具条 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif-cn text-xl font-bold text-primary">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            共 {items.length} 条 · 在架 {liveCount} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={`搜索${noun}`}
              className="w-full pl-9 pr-3 sm:w-56"
            />
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            新建
          </Button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {keyword ? "没有匹配的记录" : `还没有${noun}，点击「新建」添加`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => {
            const archived = item.status === "archived";
            const thumb = renderThumb?.(item);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center",
                  archived && "opacity-60",
                )}
              >
                {thumb !== undefined && (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {thumb ? (
                      <img src={thumb} alt={item.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-serif-cn text-base font-bold text-primary">{item.name}</p>
                    {archived && (
                      <Badge variant="outline" className="num-label px-1.5 text-[10px] font-normal text-muted-foreground">
                        已归档
                      </Badge>
                    )}
                  </div>
                  {renderMeta && <div className="mt-1">{renderMeta(item)}</div>}
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === item.id}
                    onClick={() => handleArchiveToggle(item)}
                    className={cn(
                      !archived && "text-destructive hover:bg-destructive/10 hover:text-destructive",
                    )}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {archived ? "恢复" : "归档"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 新建 / 编辑 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif-cn text-primary">
              {editing ? `编辑${noun}` : `新建${noun}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={cn("space-y-2", (f.full || f.type === "textarea" || f.type === "image" || f.type === "list" || f.type === "multiselect") && "sm:col-span-2")}>
                <Label className="text-sm font-medium">
                  {f.label}
                  {f.required && <span className="ml-1 text-destructive">*</span>}
                </Label>

                {f.type === "list" ? (
                  <Textarea
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder ?? "每行一条"}
                    rows={Math.max(3, (values[f.key] ?? "").split("\n").length)}
                    className="px-3"
                  />
                ) : f.type === "multiselect" ? (
                  <MultiSelectInline
                    options={f.options ?? []}
                    optionLabels={f.optionLabels}
                    value={values[f.key] ?? ""}
                    onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                  />
                ) : f.type === "textarea" ? (
                  <Textarea
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    rows={3}
                    className="px-3"
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={values[f.key] ?? ""}
                    onValueChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={f.placeholder ?? "请选择"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {f.optionLabels?.[o] ?? o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "image" ? (
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {values[f.key] ? (
                        <img src={values[f.key]} alt="预览" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          无图
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        选择图片
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(f.key, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Input
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder="或直接粘贴图片地址"
                        className="px-3"
                      />
                    </div>
                  </div>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="px-3"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={saving || uploading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "保存修改" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- 多选（内联标签切换） ---------------- */

/**
 * 轻量多选：以可点击的标签呈现，点击切换选中。
 * 值以 MS_SEPARATOR 串联存放在表单字符串里。
 */
function MultiSelectInline({
  options,
  optionLabels,
  value,
  onChange,
}: {
  options: readonly string[];
  optionLabels?: Record<string, string>;
  value: string;
  onChange: (next: string) => void;
}) {
  const selected = value ? value.split(MS_SEPARATOR).filter(Boolean) : [];

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((v) => v !== opt)
      : [...selected, opt];
    onChange(next.join(MS_SEPARATOR));
  };

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无可选项</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-border bg-card p-3">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "num-label rounded-md border px-3 py-1.5 text-xs transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
            )}
          >
            {optionLabels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}
