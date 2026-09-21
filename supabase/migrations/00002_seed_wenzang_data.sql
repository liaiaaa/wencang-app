-- ============ 守艺人 ============
insert into public.artisans (name, title, craft, works, bio, image_url) values
('杨阿妮', '国家级非遗传承人', '苗绣', '蝴蝶妈妈绣、百鸟衣绣片', '杨阿妮，贵州凯里人，自幼随祖母习绣，四十余载潜心钻研苗绣技艺。她擅长平绣、锁绣与堆绣，作品色彩浓烈、构图饱满，被誉为"会绣出蝴蝶妈妈的人"。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_1483e681-9a1e-4d71-8323-ec10f53440bd.jpg'),
('韦祖英', '省级非遗传承人', '蜡染', '蝶恋花靛蓝纹、铜鼓纹蜡染', '韦祖英，贵州丹寨人，蜡染技艺代表性传承人。她以铜制蜡刀蘸蜡作画，靛蓝浸染，纹样古朴典雅，作品多次入选国内外非遗展览。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_1fc81214-b2ea-4437-8b96-909fee7a813d.jpg'),
('段树坤', '州级非遗传承人', '扎染', '云纹扎染布、板蓝根植物染', '段树坤，云南大理白族人，扎染技艺传承人。他以板蓝根植物染料反复浸染，扎结成纹，作品蓝白相间、云气氤氲，尽显白族扎染的灵动之美。', 'https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_0e0c17de-c176-4325-9570-6ae265eba587.jpg');

-- ============ 纹样 ============
insert into public.patterns (name, category, region, technique, meaning, image_url, created_at) values
('蝶恋花靛蓝纹', '蜡染', '贵州 · 丹寨', '蜡刀点蜡、靛蓝浸染', '蝶恋花纹样以蝴蝶与花卉交织，寓意万物相生、生生不息，是丹寨苗族对自然与生命的礼赞。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_225586e4-9f56-4cd9-89e5-fdbbaca317ac.jpg', '2024-03-15'),
('蝴蝶妈妈绣', '苗绣', '贵州 · 凯里', '平绣、堆绣', '蝴蝶妈妈是苗族创世神话中的始祖，绣于衣襟寓意族群繁衍、子孙绵延，是苗绣中最具神性的纹样。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_69d24cd9-bd4d-432e-bd92-c1adc4378286.jpg', '2024-05-02'),
('云纹扎染布', '扎染', '云南 · 大理', '扎结、板蓝根浸染', '云纹象征吉祥如意、风调雨顺，白族扎染以云气流动之态寄托对美好生活的祈愿。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_1c86ae44-51c7-43e4-a3d6-fb9398d0a813.jpg', '2024-06-18'),
('铜鼓纹蜡染', '蜡染', '贵州 · 丹寨', '蜡刀点蜡、靛蓝浸染', '铜鼓纹源自苗族铜鼓纹饰，象征权力与族群凝聚，是蜡染中最古老庄严的纹样之一。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_cef52ebf-6761-473b-b9b5-907307225409.jpg', '2024-07-09'),
('百鸟纹绣片', '苗绣', '贵州 · 凯里', '锁绣、平绣', '百鸟纹以群鸟环绕构图，寓意百鸟朝凤、吉祥纳福，常绣于盛装衣袖，彰显华贵。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_8fcba87a-7089-4003-943e-511a4816f5d0.jpg', '2024-08-21'),
('蝴蝶纹蜡染', '蜡染', '贵州 · 丹寨', '蜡刀点蜡、靛蓝浸染', '蝴蝶纹象征蜕变与重生，靛蓝底色上白蝶翩跹，寄托苗族对生命循环的哲思。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_dd1dbd96-24f5-4e10-80ff-e5cd56e8a824.jpg', '2024-09-03'),
('植物染扎染布', '扎染', '云南 · 大理', '扎结、植物浸染', '以天然植物染料反复浸染，纹样自然晕染，体现白族崇尚自然、天人合一的审美。', 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_94483dd0-b454-4bf6-89aa-c275e1d6adf9.jpg', '2024-09-12');

-- ============ 体验项目 ============
insert into public.experience_projects (artisan_id, name, description, duration)
select id, '苗绣基础体验', '跟随非遗传承人学习苗绣基础针法，亲手绣制一枚蝴蝶纹样绣片。', '半天' from public.artisans where craft = '苗绣';
insert into public.experience_projects (artisan_id, name, description, duration)
select id, '蜡染工艺体验', '使用铜制蜡刀在白布上点蜡作画，体验靛蓝浸染全过程。', '全天' from public.artisans where craft = '蜡染';
insert into public.experience_projects (artisan_id, name, description, duration)
select id, '扎染技法体验', '学习扎结技法与板蓝根植物染，制作一块云纹扎染方巾。', '半天' from public.artisans where craft = '扎染';

-- ============ 文创商品 ============
insert into public.products (name, price, craft_description, artisan_id, artisan_name, image_url)
select '蝶恋花靛蓝蜡染围巾', 368.00, '以传统蜡染工艺手工制作，靛蓝底色点缀蝶恋花纹样，天然植物染料上色，透气亲肤。', id, name, 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_cb1f5abb-f746-48c2-8dc9-28340dbdee1e.jpg' from public.artisans where craft = '蜡染';
insert into public.products (name, price, craft_description, artisan_id, artisan_name, image_url)
select '蝴蝶妈妈绣片摆件', 588.00, '苗绣传承人手工绣制，平绣与堆绣结合，色彩浓烈，可作家居装饰与收藏。', id, name, 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_da036b9d-3498-4494-abe4-baa179567fdb.jpg' from public.artisans where craft = '苗绣';
insert into public.products (name, price, craft_description, artisan_id, artisan_name, image_url)
select '云纹扎染桌布', 298.00, '白族扎染工艺制作，板蓝根植物染料反复浸染，蓝白云纹自然晕染，环保健康。', id, name, 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_94483dd0-b454-4bf6-89aa-c275e1d6adf9.jpg' from public.artisans where craft = '扎染';