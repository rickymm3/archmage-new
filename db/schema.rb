# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_03_17_171108) do
  create_table "active_spells", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "spell_id", null: false
    t.datetime "expires_at"
    t.integer "stack_count"
    t.json "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["spell_id"], name: "index_active_spells_on_spell_id"
    t.index ["user_id"], name: "index_active_spells_on_user_id"
  end

  create_table "bids", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "market_listing_id", null: false
    t.integer "amount"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["market_listing_id"], name: "index_bids_on_market_listing_id"
    t.index ["user_id"], name: "index_bids_on_user_id"
  end

  create_table "explorations", force: :cascade do |t|
    t.integer "user_id", null: false
    t.datetime "started_at"
    t.datetime "finishes_at"
    t.integer "land_reward"
    t.integer "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "unit_id"
    t.integer "quantity", default: 0
    t.json "resources_found", default: {}
    t.json "events", default: []
    t.index ["unit_id"], name: "index_explorations_on_unit_id"
    t.index ["user_id"], name: "index_explorations_on_user_id"
  end

  create_table "market_listings", force: :cascade do |t|
    t.string "item_type", null: false
    t.integer "item_id", null: false
    t.integer "current_price", default: 0
    t.integer "min_bid_increment", default: 50
    t.datetime "expires_at"
    t.integer "bidder_id"
    t.integer "status", default: 0
    t.integer "quantity", default: 1
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["bidder_id"], name: "index_market_listings_on_bidder_id"
    t.index ["item_type", "item_id"], name: "index_market_listings_on_item"
  end

  create_table "notifications", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "title"
    t.text "content"
    t.string "category"
    t.json "data"
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "recruitment_orders", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "unit_id", null: false
    t.string "tier", null: false
    t.integer "gold_invested", null: false
    t.integer "total_quantity", null: false
    t.integer "accepted_quantity", default: 0, null: false
    t.integer "duration_seconds", null: false
    t.datetime "started_at", null: false
    t.datetime "cancelled_at"
    t.datetime "completed_at"
    t.string "luck"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["unit_id"], name: "index_recruitment_orders_on_unit_id"
    t.index ["user_id", "completed_at"], name: "index_recruitment_orders_on_user_id_and_completed_at"
    t.index ["user_id"], name: "index_recruitment_orders_on_user_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.integer "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "spells", force: :cascade do |t|
    t.string "name"
    t.text "description"
    t.integer "rank"
    t.string "affinity"
    t.integer "mana_cost"
    t.integer "research_cost"
    t.string "spell_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.json "configuration"
    t.integer "rarity", default: 0
  end

  create_table "structures", force: :cascade do |t|
    t.string "name"
    t.string "slug"
    t.text "description"
    t.json "requirements"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "level_based", default: true
    t.integer "max_level", default: 10
    t.integer "land_cost", default: 1
    t.integer "base_income_gold", default: 0
    t.integer "base_income_mana", default: 0
    t.json "production"
  end

  create_table "units", force: :cascade do |t|
    t.string "name"
    t.string "slug"
    t.text "description"
    t.json "requirements"
    t.integer "upkeep_cost"
    t.integer "attack"
    t.integer "defense"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "recruitable", default: true
    t.integer "rarity", default: 0
    t.integer "mana_upkeep"
    t.integer "power"
    t.string "unit_type"
    t.string "element"
    t.integer "speed"
    t.json "abilities"
    t.index ["speed"], name: "index_units_on_speed"
  end

  create_table "user_spells", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "spell_id", null: false
    t.integer "research_progress"
    t.boolean "learned"
    t.boolean "active"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["spell_id"], name: "index_user_spells_on_spell_id"
    t.index ["user_id"], name: "index_user_spells_on_user_id"
  end

  create_table "user_structures", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "structure_id", null: false
    t.integer "quantity"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "level", default: 1
    t.index ["structure_id"], name: "index_user_structures_on_structure_id"
    t.index ["user_id"], name: "index_user_structures_on_user_id"
  end

  create_table "user_units", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "unit_id", null: false
    t.integer "quantity"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "garrison", default: 0
    t.integer "exploring", default: 0
    t.integer "hero_id"
    t.index ["hero_id"], name: "index_user_units_on_hero_id"
    t.index ["unit_id"], name: "index_user_units_on_unit_id"
    t.index ["user_id"], name: "index_user_units_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "color"
    t.integer "land", default: 10, null: false
    t.datetime "protection_expires_at"
    t.integer "gold"
    t.integer "mana"
    t.datetime "tax_cooldown"
    t.float "morale", default: 100.0
    t.datetime "morale_updated_at"
    t.datetime "last_mana_recharge_at"
    t.integer "active_attack_spell_id"
    t.integer "active_defense_spell_id"
    t.boolean "auto_reinforce", default: false
    t.json "scouted_targets"
    t.datetime "last_scouted_at"
    t.string "username"
    t.string "auth_token"
    t.string "kingdom_name", limit: 15
    t.index ["auth_token"], name: "index_users_on_auth_token", unique: true
    t.index ["color"], name: "index_users_on_color"
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
    t.index ["kingdom_name"], name: "index_users_on_kingdom_name", unique: true
    t.index ["username"], name: "index_users_on_username"
  end

  add_foreign_key "active_spells", "spells"
  add_foreign_key "active_spells", "users"
  add_foreign_key "bids", "market_listings"
  add_foreign_key "bids", "users"
  add_foreign_key "explorations", "units"
  add_foreign_key "explorations", "users"
  add_foreign_key "market_listings", "users", column: "bidder_id"
  add_foreign_key "notifications", "users"
  add_foreign_key "recruitment_orders", "units"
  add_foreign_key "recruitment_orders", "users"
  add_foreign_key "sessions", "users"
  add_foreign_key "user_spells", "spells"
  add_foreign_key "user_spells", "users"
  add_foreign_key "user_structures", "structures"
  add_foreign_key "user_structures", "users"
  add_foreign_key "user_units", "units"
  add_foreign_key "user_units", "users"
end
