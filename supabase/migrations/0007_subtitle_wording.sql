-- Final wording for chat subtitles: every sentence ends with punctuation.
update public.chats set description = 'Welcome your leads here and congratulate your newest business partners on affiliating. Please do not ask any questions here. If you have a question, post it in our Affiliates Only chats.',
  description_lead = 'Welcome to the family, feel free to introduce yourself and ask any questions you may have.' where slug = 'welcome-discussion';
update public.chats set description = 'Share your business, personal, and water wins here. Be mindful of using the word ''lead/s'' as they are in this chat as well.',
  description_lead = 'Check out some wins from members in our community.' where slug = 'wins';
update public.chats set description = 'Not sure where to ask your question? Post it here!' where slug = 'qa-discussion';
update public.chats set description = 'Ask any questions you have about ads, ads graphics, Meta, the Meta Business Suite, forms, etc.' where slug = 'ads';
update public.chats set description = 'Ask any questions you have about in-person sales, water demos, business cards/pamphlets, etc.' where slug = 'in-person-sales';
update public.chats set description = 'Need help with onboarding or have any questions about the business launch course? Ask them here.' where slug = 'onboarding';
update public.chats set description = 'Ask any questions here related to the products, pre-filtration, installation, taps, etc.' where slug = 'product-questions';
update public.chats set description = 'Request a new resource, ask where to find one, or share one of your own to be added to the community.' where slug = 'resources';
update public.chats set description = 'Suggest how to respond, and vote on the best answers.' where slug = 'verbiage-objections';
