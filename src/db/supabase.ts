
                import { createClient } from "@supabase/supabase-js";

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                // 演示模式下本模块会被 vite 别名替换为 supabase.mock.ts（其中该值为 true），
                // 因此这里读到的值就等价于"当前是否演示模式"，无需再判断环境变量。
                export const isMockMode = false;

                export const supabase = createClient(supabaseUrl, supabaseAnonKey);
                