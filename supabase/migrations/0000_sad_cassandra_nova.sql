CREATE TABLE "question_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"parent_group_id" uuid,
	"color" text,
	"collapsed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"group_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"options" jsonb,
	"select_levels" jsonb,
	"table_title" text,
	"table_columns" jsonb,
	"table_rows_data" jsonb,
	"image_url" text,
	"video_url" text,
	"allow_other_option" boolean DEFAULT false,
	"min_selections" integer,
	"max_selections" integer,
	"notice_content" text,
	"requires_acknowledgment" boolean DEFAULT false,
	"table_validation_rules" jsonb,
	"display_condition" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" jsonb NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"category" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"question_responses" jsonb NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" text,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text,
	"private_token" uuid DEFAULT gen_random_uuid(),
	"is_public" boolean DEFAULT true NOT NULL,
	"allow_multiple_responses" boolean DEFAULT false NOT NULL,
	"show_progress_bar" boolean DEFAULT true NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"require_login" boolean DEFAULT false NOT NULL,
	"end_date" timestamp with time zone,
	"max_responses" integer,
	"thank_you_message" text DEFAULT '응답해주셔서 감사합니다!' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_question_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."question_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;