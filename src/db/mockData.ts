// ============================================================
// 演示模式（mock）种子数据
// 数据字段与 supabase/migrations/00001_create_wenzang_schema.sql 完全一致，
// 前 7 条纹样、3 位守艺人、3 个体验项目、3 件文创商品直接取自
// 00002_seed_wenzang_data.sql，其余按同一风格扩写，用于离线演示。
//
// 说明：守艺人为虚构的示例人物，仅用于平台功能演示。
// ============================================================

import type {
  Pattern,
  Artisan,
  ExperienceProject,
  Product,
  Booking,
  Order,
  AiPattern,
} from "@/types/types";
import { withArchive } from "./patternArchive";

const IMG = (id: string) => `https://miaoda-site-img.cdn.bcebos.com/images/${id}`;

// ---------- 演示账号 ----------
// 管理员：admin@miaoda.com / wencang2026（登录时输入 admin / wencang2026）
// 普通用户：demo@miaoda.com / demo123456
export const MOCK_ADMIN_EMAIL = "admin@miaoda.com";
export const MOCK_USERS = [
  { id: "u-admin-0001", email: MOCK_ADMIN_EMAIL, password: "wencang2026", role: "admin" as const },
  { id: "u-demo-0001", email: "demo@miaoda.com", password: "demo123456", role: "user" as const },
  { id: "u-lin-0001", email: "lin@miaoda.com", password: "demo123456", role: "user" as const },
];

// ---------- 守艺人（3 位，均为示例档案） ----------
export const MOCK_ARTISANS: Artisan[] = [
  {
    id: "a0000001-0000-4000-8000-000000000001",
    name: "杨阿妮",
    title: "国家级非遗传承人",
    region: "贵州 · 凯里",
    craft: "苗绣",
    works: "蝴蝶妈妈绣、百鸟衣绣片",
    bio: "杨阿妮，贵州凯里人，自幼随祖母习绣，四十余载潜心钻研苗绣技艺。她擅长平绣、锁绣与堆绣，作品色彩浓烈、构图饱满，被誉为“会绣出蝴蝶妈妈的人”。",
    image_url: IMG("baidu_image_search_1483e681-9a1e-4d71-8323-ec10f53440bd.jpg"),
    created_at: "2024-03-01T00:00:00.000Z",
  },
  {
    id: "a0000002-0000-4000-8000-000000000002",
    name: "韦祖英",
    title: "省级非遗传承人",
    region: "贵州 · 丹寨",
    craft: "蜡染",
    works: "蝶恋花靛蓝纹、铜鼓纹蜡染",
    bio: "韦祖英，贵州丹寨人，蜡染技艺代表性传承人。她以铜制蜡刀蘸蜡作画，靛蓝浸染，纹样古朴典雅，作品多次入选国内外非遗展览。",
    image_url: IMG("baidu_image_search_1fc81214-b2ea-4437-8b96-909fee7a813d.jpg"),
    created_at: "2024-03-02T00:00:00.000Z",
  },
  {
    id: "a0000003-0000-4000-8000-000000000003",
    name: "段树坤",
    title: "州级非遗传承人",
    region: "云南 · 大理",
    craft: "扎染",
    works: "云纹扎染布、板蓝根植物染",
    bio: "段树坤，云南大理白族人，扎染技艺传承人。他以板蓝根植物染料反复浸染，扎结成纹，作品蓝白相间、云气氤氲，尽显白族扎染的灵动之美。",
    image_url: IMG("MiaoTu_0e0c17de-c176-4325-9570-6ae265eba587.jpg"),
    created_at: "2024-03-03T00:00:00.000Z",
  },
];

// ---------- 纹样（15 条） ----------
// 基础字段来自 00002 迁移（前 7 条）与同风格扩写（后 8 条）；
// 档案深化字段（工艺流程 / 文化故事 / 应用场景 / 相关纹样）
// 由 patternArchive.ts 按 id 合并进来。
const MOCK_PATTERNS_BASE: Pattern[] = [
  {
    id: "p0000001-0000-4000-8000-000000000001",
    name: "蝶恋花靛蓝纹",
    category: "蜡染",
    region: "贵州 · 丹寨",
    technique: "蜡刀点蜡、靛蓝浸染",
    meaning: "蝶恋花纹样以蝴蝶与花卉交织，寓意万物相生、生生不息，是丹寨苗族对自然与生命的礼赞。",
    image_url: IMG("baidu_image_search_225586e4-9f56-4cd9-89e5-fdbbaca317ac.jpg"),
    created_at: "2024-03-15T00:00:00.000Z",
  },
  {
    id: "p0000002-0000-4000-8000-000000000002",
    name: "蝴蝶妈妈绣",
    category: "苗绣",
    region: "贵州 · 凯里",
    technique: "平绣、堆绣",
    meaning: "蝴蝶妈妈是苗族创世神话中的始祖，绣于衣襟寓意族群繁衍、子孙绵延，是苗绣中最具神性的纹样。",
    image_url: IMG("baidu_image_search_69d24cd9-bd4d-432e-bd92-c1adc4378286.jpg"),
    created_at: "2024-05-02T00:00:00.000Z",
  },
  {
    id: "p0000003-0000-4000-8000-000000000003",
    name: "云纹扎染布",
    category: "扎染",
    region: "云南 · 大理",
    technique: "扎结、板蓝根浸染",
    meaning: "云纹象征吉祥如意、风调雨顺，白族扎染以云气流动之态寄托对美好生活的祈愿。",
    image_url: IMG("baidu_image_search_1c86ae44-51c7-43e4-a3d6-fb9398d0a813.jpg"),
    created_at: "2024-06-18T00:00:00.000Z",
  },
  {
    id: "p0000004-0000-4000-8000-000000000004",
    name: "铜鼓纹蜡染",
    category: "蜡染",
    region: "贵州 · 丹寨",
    technique: "蜡刀点蜡、靛蓝浸染",
    meaning: "铜鼓纹源自苗族铜鼓纹饰，象征权力与族群凝聚，是蜡染中最古老庄严的纹样之一。",
    image_url: IMG("baidu_image_search_cef52ebf-6761-473b-b9b5-907307225409.jpg"),
    created_at: "2024-07-09T00:00:00.000Z",
  },
  {
    id: "p0000005-0000-4000-8000-000000000005",
    name: "百鸟纹绣片",
    category: "苗绣",
    region: "贵州 · 凯里",
    technique: "锁绣、平绣",
    meaning: "百鸟纹以群鸟环绕构图，寓意百鸟朝凤、吉祥纳福，常绣于盛装衣袖，彰显华贵。",
    image_url: IMG("baidu_image_search_8fcba87a-7089-4003-943e-511a4816f5d0.jpg"),
    created_at: "2024-08-21T00:00:00.000Z",
  },
  {
    id: "p0000006-0000-4000-8000-000000000006",
    name: "蝴蝶纹蜡染",
    category: "蜡染",
    region: "贵州 · 丹寨",
    technique: "蜡刀点蜡、靛蓝浸染",
    meaning: "蝴蝶纹象征蜕变与重生，靛蓝底色上白蝶翩跹，寄托苗族对生命循环的哲思。",
    image_url: IMG("baidu_image_search_dd1dbd96-24f5-4e10-80ff-e5cd56e8a824.jpg"),
    created_at: "2024-09-03T00:00:00.000Z",
  },
  {
    id: "p0000007-0000-4000-8000-000000000007",
    name: "植物染扎染布",
    category: "扎染",
    region: "云南 · 大理",
    technique: "扎结、植物浸染",
    meaning: "以天然植物染料反复浸染，纹样自然晕染，体现白族崇尚自然、天人合一的审美。",
    image_url: IMG("baidu_image_search_94483dd0-b454-4bf6-89aa-c275e1d6adf9.jpg"),
    created_at: "2024-09-12T00:00:00.000Z",
  },
  {
    id: "p0000008-0000-4000-8000-000000000008",
    name: "百鸟衣绣片",
    category: "苗绣",
    region: "贵州 · 凯里",
    technique: "平绣、锁绣",
    meaning: "百鸟衣是苗族盛装礼服，衣身缀满鸟纹绣片，寓意族群如百鸟齐飞、生生不息。",
    image_url: IMG("baidu_image_search_8fcba87a-7089-4003-943e-511a4816f5d0.jpg"),
    created_at: "2024-09-25T00:00:00.000Z",
  },
  {
    id: "p0000009-0000-4000-8000-000000000009",
    name: "锦鸡纹袖片",
    category: "苗绣",
    region: "贵州 · 台江",
    technique: "堆绣、打籽绣",
    meaning: "锦鸡在苗族传说中是引路的神鸟，绣于袖口寓意吉祥引路、前程似锦。",
    image_url: IMG("baidu_image_search_da036b9d-3498-4494-abe4-baa179567fdb.jpg"),
    created_at: "2024-10-08T00:00:00.000Z",
  },
  {
    id: "p0000010-0000-4000-8000-000000000010",
    name: "铜鼓云雷纹",
    category: "蜡染",
    region: "贵州 · 丹寨",
    technique: "蜡刀点蜡、靛蓝浸染",
    meaning: "云雷纹回旋连绵，取意天雷鼓动、风调雨顺，是蜡染中最具秩序感的几何纹样。",
    image_url: IMG("baidu_image_search_cef52ebf-6761-473b-b9b5-907307225409.jpg"),
    created_at: "2024-10-20T00:00:00.000Z",
  },
  {
    id: "p0000011-0000-4000-8000-000000000011",
    name: "白族蝶纹扎染",
    category: "扎染",
    region: "云南 · 周城",
    technique: "扎结、板蓝根浸染",
    meaning: "白族视蝴蝶为忠贞与美好的象征，蝶纹扎染常作嫁妆，寓意比翼连枝、和美一生。",
    image_url: IMG("baidu_image_search_94483dd0-b454-4bf6-89aa-c275e1d6adf9.jpg"),
    created_at: "2024-11-05T00:00:00.000Z",
  },
  {
    id: "p0000012-0000-4000-8000-000000000012",
    name: "鱼鸟纹蜡染",
    category: "蜡染",
    region: "贵州 · 丹寨",
    technique: "蜡刀点蜡、靛蓝浸染",
    meaning: "鱼与鸟同框，取“鱼鸟相戏”之意，象征丰饶与自由，寄托对五谷丰登的祈愿。",
    image_url: IMG("baidu_image_search_225586e4-9f56-4cd9-89e5-fdbbaca317ac.jpg"),
    created_at: "2024-11-18T00:00:00.000Z",
  },
  {
    id: "p0000013-0000-4000-8000-000000000013",
    name: "板蓝根渐变扎染",
    category: "扎染",
    region: "云南 · 大理",
    technique: "多次浸染、氧化显色",
    meaning: "以浸染次数控制蓝色深浅，由月白至靛青层层过渡，寓意岁月沉淀、历久弥新。",
    image_url: IMG("baidu_image_search_1c86ae44-51c7-43e4-a3d6-fb9398d0a813.jpg"),
    created_at: "2024-12-02T00:00:00.000Z",
  },
  {
    id: "p0000014-0000-4000-8000-000000000014",
    name: "万字纹蜡染",
    category: "蜡染",
    region: "贵州 · 黄平",
    technique: "蜡刀点蜡、靛蓝浸染",
    meaning: "万字纹连绵不断，寓意绵长不绝、福泽久远，多用于被面与头巾等日常织物。",
    image_url: IMG("baidu_image_search_dd1dbd96-24f5-4e10-80ff-e5cd56e8a824.jpg"),
    created_at: "2024-12-16T00:00:00.000Z",
  },
  {
    id: "p0000015-0000-4000-8000-000000000015",
    name: "蝴蝶妈妈衣襟绣",
    category: "苗绣",
    region: "贵州 · 凯里",
    technique: "平绣、堆绣",
    meaning: "衣襟处的蝴蝶妈妈以五彩丝线盘绕而成，是苗族母亲为女儿缝制的护身祝福。",
    image_url: IMG("baidu_image_search_69d24cd9-bd4d-432e-bd92-c1adc4378286.jpg"),
    created_at: "2025-01-08T00:00:00.000Z",
  },
];

/** 15 条纹样（含档案深化字段） */
export const MOCK_PATTERNS: Pattern[] = withArchive(MOCK_PATTERNS_BASE);

// ---------- 体验项目（3 个） ----------
export const MOCK_PROJECTS: ExperienceProject[] = [
  {
    id: "e0000001-0000-4000-8000-000000000001",
    artisan_id: "a0000001-0000-4000-8000-000000000001",
    name: "苗绣基础体验",
    description: "跟随非遗传承人学习苗绣基础针法，亲手绣制一枚蝴蝶纹样绣片。",
    duration: "半天",
    created_at: "2024-03-05T00:00:00.000Z",
  },
  {
    id: "e0000002-0000-4000-8000-000000000002",
    artisan_id: "a0000002-0000-4000-8000-000000000002",
    name: "蜡染工艺体验",
    description: "使用铜制蜡刀在白布上点蜡作画，体验靛蓝浸染全过程。",
    duration: "全天",
    created_at: "2024-03-06T00:00:00.000Z",
  },
  {
    id: "e0000003-0000-4000-8000-000000000003",
    artisan_id: "a0000003-0000-4000-8000-000000000003",
    name: "扎染技法体验",
    description: "学习扎结技法与板蓝根植物染，制作一块云纹扎染方巾。",
    duration: "半天",
    created_at: "2024-03-07T00:00:00.000Z",
  },
];

// ---------- 文创商品（3 件） ----------
export const MOCK_PRODUCTS: Product[] = [
  {
    id: "g0000001-0000-4000-8000-000000000001",
    name: "蝶恋花靛蓝蜡染围巾",
    price: 368,
    craft_description: "以传统蜡染工艺手工制作，靛蓝底色点缀蝶恋花纹样，天然植物染料上色，透气亲肤。",
    artisan_id: "a0000002-0000-4000-8000-000000000002",
    artisan_name: "韦祖英",
    image_url: IMG("baidu_image_search_cb1f5abb-f746-48c2-8dc9-28340dbdee1e.jpg"),
    created_at: "2024-04-10T00:00:00.000Z",
  },
  {
    id: "g0000002-0000-4000-8000-000000000002",
    name: "蝴蝶妈妈绣片摆件",
    price: 588,
    craft_description: "苗绣传承人手工绣制，平绣与堆绣结合，色彩浓烈，可作家居装饰与收藏。",
    artisan_id: "a0000001-0000-4000-8000-000000000001",
    artisan_name: "杨阿妮",
    image_url: IMG("baidu_image_search_da036b9d-3498-4494-abe4-baa179567fdb.jpg"),
    created_at: "2024-04-12T00:00:00.000Z",
  },
  {
    id: "g0000003-0000-4000-8000-000000000003",
    name: "云纹扎染桌布",
    price: 298,
    craft_description: "白族扎染工艺制作，板蓝根植物染料反复浸染，蓝白云纹自然晕染，环保健康。",
    artisan_id: "a0000003-0000-4000-8000-000000000003",
    artisan_name: "段树坤",
    image_url: IMG("baidu_image_search_94483dd0-b454-4bf6-89aa-c275e1d6adf9.jpg"),
    created_at: "2024-04-15T00:00:00.000Z",
  },
];

// ---------- 预约示例（供管理员视角演示） ----------
export const MOCK_BOOKINGS: Booking[] = [
  {
    id: "b0000001-0000-4000-8000-000000000001",
    user_id: "u-demo-0001",
    artisan_id: "a0000002-0000-4000-8000-000000000002",
    project_id: "e0000002-0000-4000-8000-000000000002",
    artisan_name: "韦祖英",
    project_name: "蜡染工艺体验",
    book_date: "2025-03-18",
    time_slot: "全天 09:00-16:00",
    contact_name: "演示用户",
    contact_phone: "13800000001",
    status: "待确认",
    created_at: "2025-03-10T09:12:00.000Z",
  },
  {
    id: "b0000002-0000-4000-8000-000000000002",
    user_id: "u-demo-0001",
    artisan_id: "a0000001-0000-4000-8000-000000000001",
    project_id: "e0000001-0000-4000-8000-000000000001",
    artisan_name: "杨阿妮",
    project_name: "苗绣基础体验",
    book_date: "2025-02-20",
    time_slot: "上午 09:00-12:00",
    contact_name: "演示用户",
    contact_phone: "13800000001",
    status: "已完成",
    created_at: "2025-02-12T14:30:00.000Z",
  },
  {
    id: "b0000003-0000-4000-8000-000000000003",
    user_id: "u-lin-0001",
    artisan_id: "a0000003-0000-4000-8000-000000000003",
    project_id: "e0000003-0000-4000-8000-000000000003",
    artisan_name: "段树坤",
    project_name: "扎染技法体验",
    book_date: "2025-03-22",
    time_slot: "下午 13:00-16:00",
    contact_name: "体验用户",
    contact_phone: "13800000002",
    status: "已确认",
    created_at: "2025-03-11T10:05:00.000Z",
  },
];

// ---------- 订单示例 ----------
export const MOCK_ORDERS: Order[] = [
  {
    id: "o0000001-0000-4000-8000-000000000001",
    user_id: "u-demo-0001",
    product_id: "g0000001-0000-4000-8000-000000000001",
    product_name: "蝶恋花靛蓝蜡染围巾",
    order_number: "WZ2025031000012",
    price: 368,
    contact_name: "演示用户",
    contact_phone: "13800000001",
    address: "贵州省黔东南州凯里市示例路 1 号",
    status: "已发货",
    created_at: "2025-03-10T11:00:00.000Z",
  },
];

// ---------- AI 纹样示例 ----------
export const MOCK_AI_PATTERNS: AiPattern[] = [];
