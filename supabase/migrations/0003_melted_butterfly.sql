ALTER TABLE "questions" ADD COLUMN "question_code" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "is_custom_spss_var_name" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "export_label" text;