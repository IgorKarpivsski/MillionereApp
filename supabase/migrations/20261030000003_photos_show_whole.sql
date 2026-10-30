-- The photo frame is wide and low (about 2:1): a "cover" fit cut the heads off portraits.
-- Every photo taller than the frame is shown whole until the app draws a better frame.
update public.questions
   set image = jsonb_set(image, '{fit}', '"contain"')
 where image ->> 'kind' = 'photo' and (image ->> 'h')::int > (image ->> 'w')::int * 0.62
   and coalesce(image ->> 'fit', 'cover') <> 'contain';
