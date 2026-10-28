CREATE TABLE "karakeep_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"base_url" varchar(2048) NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "url" varchar(2048);--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "source" varchar(120);--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "karakeep_bookmark_id" varchar(255);--> statement-breakpoint
ALTER TABLE "karakeep_connections" ADD CONSTRAINT "karakeep_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "karakeep_connections_updated_at_idx" ON "karakeep_connections" USING btree ("updated_at");
