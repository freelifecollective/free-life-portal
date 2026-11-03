-- The first Canva templates for the Advertising > Canva Templates tab. Safe to run twice: a link already there is skipped.
insert into public.resource_items (category, title, url)
select v.category, v.title, v.url
from (values
  ('canva', 'Canva template 1', 'https://www.canva.com/design/DAGozOhjXa8/p7juOL08zNS2zKaWyWSYcQ/view?utm_content=DAGozOhjXa8&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 2', 'https://www.canva.com/design/DAGiCKmGrME/anDwjBwxTyvvNLhFOXsbmg/view?utm_content=DAGiCKmGrME&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 3', 'https://www.canva.com/design/DAFx_xDs1wU/eRPD2GKs1illP-Bt8g5PMQ/view?utm_content=DAFx_xDs1wU&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 4', 'https://www.canva.com/design/DAGhxT5xmIU/lmzxzC4uwVf8bAwTxszs-Q/view?utm_content=DAGhxT5xmIU&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 5', 'https://www.canva.com/design/DAGt76v6FCg/aQY5qNYxuirpGjIjnFQRPw/view?utm_content=DAGt76v6FCg&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 6', 'https://www.canva.com/design/DAF1nCBBkD4/lZoJnAJVMAAi89NTU6v_oQ/view?utm_content=DAF1nCBBkD4&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 7', 'https://www.canva.com/design/DAF4OJVXIbc/7tponUiBNucEk1jqC0a2CQ/view?utm_content=DAF4OJVXIbc&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 8', 'https://www.canva.com/design/DAGf3jHLvZU/KbUnPiFe4ti-IfVMYW-D3A/view?utm_content=DAGf3jHLvZU&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview'),
  ('canva', 'Canva template 9', 'https://www.canva.com/design/DAGKHWpoBew/cnLItZgYPYT1Rf3Jru844w/view?utm_content=DAGKHWpoBew&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview')
) as v(category, title, url)
where not exists (select 1 from public.resource_items r where r.category = v.category and r.url = v.url);
