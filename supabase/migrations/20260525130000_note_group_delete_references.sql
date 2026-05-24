alter table public.jobs
  drop constraint if exists jobs_note_group_id_fkey;

alter table public.jobs
  add constraint jobs_note_group_id_fkey
  foreign key (note_group_id) references public.note_groups (id) on delete set null;

alter table public.question_card_reviews
  drop constraint if exists question_card_reviews_question_card_id_fkey;

alter table public.question_card_reviews
  add constraint question_card_reviews_question_card_id_fkey
  foreign key (question_card_id) references public.question_cards (id) on delete cascade;

alter table public.question_card_reviews
  drop constraint if exists question_card_reviews_note_group_id_fkey;

alter table public.question_card_reviews
  add constraint question_card_reviews_note_group_id_fkey
  foreign key (note_group_id) references public.note_groups (id) on delete cascade;
