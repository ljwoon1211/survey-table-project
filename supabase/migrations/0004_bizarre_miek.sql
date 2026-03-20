CREATE TABLE "response_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"text_value" text,
	"array_value" jsonb,
	"object_value" jsonb,
	"question_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_note" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN "version_id" uuid;--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "current_version_id" uuid;--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "response_answers" ADD CONSTRAINT "response_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 인덱스: survey_versions
CREATE INDEX "idx_survey_versions_survey_id" ON "survey_versions" ("survey_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_survey_versions_survey_version" ON "survey_versions" ("survey_id", "version_number");--> statement-breakpoint
-- 인덱스: response_answers
CREATE INDEX "idx_response_answers_response_id" ON "response_answers" ("response_id");--> statement-breakpoint
CREATE INDEX "idx_response_answers_question_id" ON "response_answers" ("question_id");--> statement-breakpoint
CREATE INDEX "idx_response_answers_response_question" ON "response_answers" ("response_id", "question_id");--> statement-breakpoint
-- 인덱스: 기존 테이블 (성능 개선)
CREATE INDEX "idx_surveys_status" ON "surveys" ("status");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_survey_id" ON "survey_responses" ("survey_id");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_completed" ON "survey_responses" ("survey_id", "is_completed");--> statement-breakpoint
CREATE INDEX "idx_survey_responses_version_id" ON "survey_responses" ("version_id");--> statement-breakpoint
CREATE INDEX "idx_questions_survey_id" ON "questions" ("survey_id");--> statement-breakpoint
CREATE INDEX "idx_questions_survey_order" ON "questions" ("survey_id", "order");--> statement-breakpoint
CREATE INDEX "idx_question_groups_survey_id" ON "question_groups" ("survey_id");