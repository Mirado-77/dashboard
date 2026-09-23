CREATE TABLE "service_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"service_id" text NOT NULL,
	"credentials" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_subscription" ADD CONSTRAINT "service_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_subscription_user_service_idx" ON "service_subscription" USING btree ("user_id","service_id");--> statement-breakpoint
CREATE INDEX "service_subscription_user_id_idx" ON "service_subscription" USING btree ("user_id");