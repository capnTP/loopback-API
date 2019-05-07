SELECT  on P.* , PL.name as localize_name, PL.seo_description as localized_seo_description,PL.description as localized_description  FROM main.products_categories PC left join main.products P ON PC.tour_id = P.id and P.city_id = 1 left join main.products_lang as PL on PL.lang_id = 2 and PC.tour_id = PL.tour_id where P.id is NOT null GROUP BY PC.tour_id,P.id order by P.name ASC limit 50 offset 1



SELECT   P.*,(array_agg(PL.name  ORDER BY PL.name DESC))[1] as localize_name,PL.short_description as localized_description  FROM main.products_categories PC left join main.products P ON PC.tour_id = P.id and P.city_id = 1 left join main.products_lang as PL on PL.lang_id = 1 and PC.tour_id = PL.tour_id where P.id is NOT null GROUP BY PC.tour_id,P.id order by P.name ASC limit 50 offset 1


//working
SELECT   P.*,PL.name as localize_name, PL.seo_description as localized_seo_description,PL.short_description as localized_description  FROM main.products_categories PC left join main.products P ON PC.tour_id = P.id and P.city_id = 1 left join main.products_lang as PL on PL.lang_id = 3 and PC.tour_id = PL.tour_id where P.id is NOT null GROUP BY PC.tour_id,P.id,PL.name,PL.seo_description,PL.short_description order by P.name ASC limit 50 offset 1



// new multi language auto complete

SELECT main.products_lang.name as name,main.products_lang.tour_id as id,main.products.slug as slug FROM main.products_lang left join main.products on main.products_lang.tour_id = main.products.id where main.products_lang.lang_id = 2 and (LOWER(products_lang.name) LIKE '%ban%' )
UNION
SELECT main.product.name as name,main.products.id as id,main.products.slug as slug FROM main.products where main.products.default_language_id = 1 and (LOWER(products.name) LIKE '%ban%' )




Updated complete

(SELECT main.cities_lang.name as name,main.cities_lang.city_id as id,main.cities.slug as slug,'city' as type FROM main.cities_lang
      left join main.cities on main.cities_lang.city_id = main.cities.id
      where main.cities_lang.lang_id = 1 and (LOWER(cities_lang.name) LIKE '%ban%' ) ORDER BY name ASC limit 5)
UNION
(SELECT main.cities.name as name, main.cities.id as id,main.cities.slug as slug,'city' as type FROM main.cities
       where (LOWER(cities.name) LIKE '%ban%' ) ORDER BY name ASC limit 5)
UNION
(SELECT main.products_lang.name as name,main.products_lang.tour_id as id,main.products.slug as slug,'product' as type FROM main.products_lang
      left join main.products on main.products_lang.tour_id = main.products.id
      where main.products_lang.lang_id = 1 and (LOWER(products_lang.name) LIKE '%ban%' ) ORDER BY name ASC limit 5)
UNION
(SELECT main.products.name as name, main.products.id as id,main.products.slug as slug,'product' as type FROM main.products
       where main.products.default_language_id = 1 and (LOWER(products.name) LIKE '%ban%' ) ORDER BY name ASC limit 5)  ORDER BY name ASC limit 5
