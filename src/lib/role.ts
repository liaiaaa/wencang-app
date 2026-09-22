import { supabase, isMockMode } from "@/db/supabase";

// 演示模式内置的管理员账号（登录时输入 admin / wencang2026）
export const ADMIN_EMAIL = "admin@miaoda.com";

export type UserRole = "admin" | "user";

/** 当前是否为本地演示（mock）模式：由数据源模块自身导出，避免环境变量判断不一致 */
export function isMock(): boolean {
  return isMockMode;
}

/**
 * 解析当前用户角色。
 * - 演示模式：按内置管理员邮箱判定，无需数据库。
 * - 云端模式：读取 public.profiles.role（见 supabase/migrations/00008_add_role_and_admin.sql）。
 */
export async function fetchUserRole(userId: string, email?: string | null): Promise<UserRole> {
  if (isMock()) {
    return email?.toLowerCase() === ADMIN_EMAIL ? "admin" : "user";
  }
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (error) return "user";
    return (data as { role?: string } | null)?.role === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}
