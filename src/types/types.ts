export type PatternCategory = "蜡染" | "扎染" | "苗绣";

/** 内容记录状态：archived 为软删除，列表默认不展示 */
export type ContentStatus = "published" | "archived";

export interface Pattern {
  id: string;
  name: string;
  category: PatternCategory;
  region: string;
  technique: string;
  meaning: string;
  image_url: string;
  created_at: string;
  status?: ContentStatus;

  /* -------- 档案深化字段（均为可选，老数据缺失时详情页自动隐藏对应区块） -------- */

  /** 工艺流程：步骤化的工艺顺序（3~6 步） */
  process_steps?: string[];
  /** 文化故事：长文案 */
  story?: string;
  /** 传统应用场景，如 服饰 / 被面 / 背扇 / 门帘 */
  usage_scenes?: string[];
  /** 相关纹样 id，用于详情页推荐 */
  related_patterns?: string[];
}

export interface Artisan {
  id: string;
  name: string;
  title: string;
  region: string | null;
  craft: string;
  works: string;
  bio: string;
  image_url: string;
  created_at: string;
  status?: ContentStatus;
}

export interface ExperienceProject {
  id: string;
  artisan_id: string | null;
  name: string;
  description: string;
  duration: string;
  created_at: string;
  /** 体验项目配图；缺省时由读取层按工艺类别程序化生成 */
  image_url?: string;
}

export type BookingStatus = "待确认" | "已确认" | "已完成";

export interface Booking {
  id: string;
  user_id: string;
  artisan_id: string | null;
  project_id: string | null;
  artisan_name: string;
  project_name: string;
  book_date: string;
  time_slot: string;
  contact_name: string;
  contact_phone: string;
  status: BookingStatus;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  craft_description: string;
  artisan_id: string | null;
  artisan_name: string;
  image_url: string;
  created_at: string;
  status?: ContentStatus;
}

export type OrderStatus = "待发货" | "已发货" | "已完成";

export interface Order {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  order_number: string;
  price: number;
  contact_name: string;
  contact_phone: string;
  address: string;
  status: OrderStatus;
  created_at: string;
}

export interface AiPattern {
  id: string;
  user_id: string;
  theme: string;
  category: PatternCategory;
  image_url: string;
  name: string;
  meaning: string;
  created_at: string;
}

export interface PlatformStats {
  patternCount: number;
  artisanCount: number;
  projectCount: number;
}