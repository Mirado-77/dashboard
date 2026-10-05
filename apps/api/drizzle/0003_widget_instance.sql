CREATE TABLE "widget_instance" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"service_id" text NOT NULL,
	"widget_id" text NOT NULL,
	"config" jsonb NOT NULL,
	"refresh_rate" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "widget_instance" ADD CONSTRAINT "widget_instance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_instance" ADD CONSTRAINT "widget_instance_subscription_id_service_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."service_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "widget_instance_user_id_idx" ON "widget_instance" USING btree ("user_id");