import { describe, it, expect, beforeEach } from "vitest";
import { supabase } from "@/db/supabase";
import {
  createBooking,
  fetchMyBookings,
  updateBookingStatus,
} from "@/lib/api";
import { fetchUserRole } from "@/lib/role";

// 演示模式下的完整预约闭环验证：
// 用户提交预约 → 管理员确认 → 用户端看到状态变化
const login = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

const bookingPayload = {
  artisan_id: "a0000002-0000-4000-8000-000000000002",
  artisan_name: "韦祖英",
  project_id: "e0000002-0000-4000-8000-000000000002",
  project_name: "蜡染工艺体验",
  book_date: "2025-06-01",
  time_slot: "上午 09:00-12:00",
  contact_name: "测试联系人",
  contact_phone: "13800001234",
};

describe("预约闭环（演示模式）", () => {
  beforeEach(async () => {
    await supabase.auth.signOut();
    (window as any).__wenzangMock.reset();
  });

  it("普通用户提交预约后能在自己的列表中看到「待确认」", async () => {
    await login("demo@miaoda.com", "demo123456");

    await createBooking(bookingPayload);
    const mine = await fetchMyBookings();

    const created = mine.find((b) => b.book_date === "2025-06-01");
    expect(created).toBeDefined();
    expect(created!.status).toBe("待确认");
    expect(created!.project_name).toBe("蜡染工艺体验");
  });

  it("普通用户只能看到自己的预约，看不到他人的", async () => {
    await login("demo@miaoda.com", "demo123456");
    const mine = await fetchMyBookings();

    // 种子数据中 b0000003 属于另一位用户 u-lin-0001
    expect(mine.some((b) => b.id === "b0000003-0000-4000-8000-000000000003")).toBe(false);
    // 自己的两条种子预约应可见
    expect(mine.some((b) => b.id === "b0000001-0000-4000-8000-000000000001")).toBe(true);
  });

  it("管理员可见全部预约，并能把状态改为已确认", async () => {
    await login("admin@miaoda.com", "wencang2026");

    const all = await fetchMyBookings();
    // 种子 3 条，来自两位不同用户
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all.some((b) => b.id === "b0000003-0000-4000-8000-000000000003")).toBe(true);

    await updateBookingStatus("b0000001-0000-4000-8000-000000000001", "已确认");
    const after = await fetchMyBookings();
    expect(after.find((b) => b.id === "b0000001-0000-4000-8000-000000000001")!.status).toBe("已确认");
  });

  it("全链路：用户提交 → 管理员确认 → 用户端状态变化", async () => {
    // 1. 用户提交预约
    await login("demo@miaoda.com", "demo123456");
    await createBooking(bookingPayload);
    const mineBefore = await fetchMyBookings();
    const target = mineBefore.find((b) => b.book_date === "2025-06-01")!;
    expect(target.status).toBe("待确认");

    // 2. 管理员确认
    await supabase.auth.signOut();
    await login("admin@miaoda.com", "wencang2026");
    await updateBookingStatus(target.id, "已确认");

    // 3. 用户端看到状态变化
    await supabase.auth.signOut();
    await login("demo@miaoda.com", "demo123456");
    const mineAfter = await fetchMyBookings();
    expect(mineAfter.find((b) => b.id === target.id)!.status).toBe("已确认");
  });

  it("管理员可继续标记为已完成", async () => {
    await login("admin@miaoda.com", "wencang2026");
    await updateBookingStatus("b0000001-0000-4000-8000-000000000001", "已完成");
    const all = await fetchMyBookings();
    expect(all.find((b) => b.id === "b0000001-0000-4000-8000-000000000001")!.status).toBe("已完成");
  });
});

describe("角色判定（演示模式）", () => {
  beforeEach(async () => {
    await supabase.auth.signOut();
    (window as any).__wenzangMock.reset();
  });

  it("admin@miaoda.com 判定为管理员", async () => {
    const { data } = await login("admin@miaoda.com", "wencang2026");
    const role = await fetchUserRole(data.user!.id, data.user!.email);
    expect(role).toBe("admin");
  });

  it("普通用户判定为非管理员", async () => {
    const { data } = await login("demo@miaoda.com", "demo123456");
    const role = await fetchUserRole(data.user!.id, data.user!.email);
    expect(role).toBe("user");
  });

  it("错误密码无法登录", async () => {
    const { error } = await login("admin@miaoda.com", "wrong-password");
    expect(error).not.toBeNull();
  });
});
