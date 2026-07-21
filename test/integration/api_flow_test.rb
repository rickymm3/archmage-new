require "test_helper"

# End-to-end coverage of the mobile API: register, core game loops,
# and a hero-led battle.
class ApiFlowTest < ActionDispatch::IntegrationTest
  def register!(username: "TestMage", email: "testmage@example.com", color: "pyromancer")
    post "/api/v1/auth/register", params: {
      username: username,
      email: email,
      password: "password123",
      password_confirmation: "password123",
      color: color
    }, as: :json
    assert_response :success
    @token = response.parsed_body["token"]
    assert @token.present?, "registration should return an auth token"
  end

  def auth_headers
    { "Authorization" => "Bearer #{@token}" }
  end

  def api_get(path)
    get "/api/v1#{path}", headers: auth_headers
  end

  def api_post(path, params = {})
    post "/api/v1#{path}", params: params, headers: auth_headers, as: :json
  end

  test "register grants starting kingdom and dashboard loads" do
    register!
    api_get "/dashboard"
    assert_response :success

    body = response.parsed_body
    assert_equal "TestMage", body["player"]["username"]
    assert body["player"]["gold"].positive?
  end

  test "town build deducts gold and grants structure" do
    register!
    farm = structures(:one)

    api_get "/town"
    assert_response :success
    gold_before = response.parsed_body["gold"]

    api_post "/town/build", { structure_id: farm.id, quantity: 1 }
    assert_response :success
    assert_operator response.parsed_body["gold"], :<, gold_before
  end

  test "recruitment order starts and appears in dashboard" do
    register!
    # Barracks level 1 is granted at registration only when seeded; ensure via fixture structure
    user = User.find_by!(username: "TestMage")
    barracks = structures(:two)
    us = user.user_structures.find_or_initialize_by(structure: barracks)
    us.quantity = 1
    us.level = 1
    us.save!

    api_post "/recruit", { unit_id: units(:one).id, tier: "standard" }
    assert_response :success
    assert_match(/recruitment started/i, response.parsed_body["message"])

    api_get "/dashboard"
    assert_response :success
    assert_equal 1, response.parsed_body["active_orders"].length
  end

  test "spell research invests mana" do
    register!
    # Research applies to the affinity's currently rolled target.
    api_post "/spells/general/roll", {}
    assert_response :success
    target = response.parsed_body["spell"]
    assert target, "expected a rolled spell target"

    api_post "/spells/#{target["id"]}/research", { amount: 50 }
    assert_response :success
    assert_equal 50, response.parsed_body.dig("result", "invested")
  end

  test "hero-led battle resolves and returns armies" do
    register!
    attacker = User.find_by!(username: "TestMage")
    defender = users(:two)
    defender.update!(protection_expires_at: nil)

    militia = units(:one)
    kael = units(:hero_kael)
    attacker.user_units.create!(unit: militia, quantity: 100, garrison: 0, exploring: 0)
    attacker.user_units.create!(unit: kael, quantity: 1, garrison: 0, exploring: 0)
    defender.user_units.create!(unit: militia, quantity: 20, garrison: 0, exploring: 0)

    api_post "/battles", {
      target_id: defender.id,
      units: { militia.id.to_s => 100 },
      heroes: { militia.id.to_s => kael.id }
    }
    assert_response :success

    result = response.parsed_body["result"]
    assert_includes %w[attacker defender draw], result["outcome"]

    # Verdict explains the outcome via power lost on each side
    verdict = result["verdict"]
    assert verdict.present?, "battle result should include a verdict"
    assert verdict["attacker"]["power_start"].positive?
    assert_operator verdict["attacker"]["power_end"], :<=, verdict["attacker"]["power_start"]
    assert_equal 1.25, verdict["defender_bonus"]
    assert_includes %w[power annihilation rout mutual], verdict["decided_by"]

    hero_stack = result["attacker_army"]["stacks"].find { |s| s["hero"].present? }
    assert hero_stack, "hero should be attached to a stack"
    assert_equal "General Kael", hero_stack["hero"]["name"]
    assert_match(/Physical Command/, hero_stack["hero"]["active_buff"].to_s)
  end

  test "a decisive attack razes structures and they can be extinguished" do
    register!
    attacker = User.find_by!(username: "TestMage")
    defender = users(:two)
    defender.update!(protection_expires_at: nil)

    # Give the defender a level-based structure to raze and no army to defend.
    # (users(:two) already owns barracks via the user_structures fixture.)
    barracks = structures(:two)
    ds = user_structures(:two)
    ds.update!(level: 5, quantity: 1, burning: false, damage_info: nil)
    defender.user_units.destroy_all

    # 200 militia keeps the attacker's power inside the 0.4x-2.5x strike
    # range of the (armyless) defender while still winning decisively.
    militia = units(:one)
    attacker.user_units.create!(unit: militia, quantity: 200, garrison: 0, exploring: 0)

    api_post "/battles", { target_id: defender.id, units: { militia.id.to_s => 200 } }
    assert_response :success
    assert_equal "attacker", response.parsed_body.dig("result", "outcome")

    ds.reload
    assert ds.burning?, "a razed structure should be on fire"
    assert_operator ds.level, :<, 5, "razing should have knocked a level off"
    assert_equal attacker.username, ds.damage_info["attacker_name"]

    # The defender puts out the fire (acknowledgment only — level stays reduced).
    razed_level = ds.level
    defender.regenerate_auth_token
    defender_token = defender.auth_token
    post "/api/v1/town/extinguish",
      params: { structure_id: barracks.id },
      headers: { "Authorization" => "Bearer #{defender_token}" }, as: :json
    assert_response :success

    ds.reload
    assert_not ds.burning?, "fire should be out after extinguishing"
    assert_nil ds.damage_info
    assert_equal razed_level, ds.level, "extinguishing must not restore lost levels"
  end

  test "extinguishing a structure that is not on fire is rejected" do
    register!
    user = User.find_by!(username: "TestMage")
    barracks = structures(:two)
    user.user_structures.create!(structure: barracks, level: 2, quantity: 1)

    api_post "/town/extinguish", { structure_id: barracks.id }
    assert_response :unprocessable_entity
  end

  test "attacks outside the power range are rejected" do
    register!
    attacker = User.find_by!(username: "TestMage")
    defender = users(:two)
    defender.update!(protection_expires_at: nil)
    defender.user_units.destroy_all

    # A massive army pushes the attacker far beyond 2.5x the defender's power.
    militia = units(:one)
    attacker.user_units.create!(unit: militia, quantity: 5000, garrison: 0, exploring: 0)

    api_post "/battles", { target_id: defender.id, units: { militia.id.to_s => 5000 } }
    assert_response :unprocessable_entity
    assert_match(/outside your attack range/i, response.parsed_body["error"])

    # Targeting index reflects the same rule
    api_get "/battles"
    assert_response :success
    body = response.parsed_body
    assert body["range"]["min"].positive?
    refute body["targets"].any? { |t| t["id"] == defender.id },
      "out-of-range defender should not appear in the target list"

    # Manual search still finds them, marked unattackable with a reason
    api_get "/battles/search?q=#{defender.username}"
    assert_response :success
    hit = response.parsed_body["results"].find { |r| r["id"] == defender.id }
    assert hit, "search should find the kingdom by name"
    assert_equal false, hit["in_range"]
    assert_match(/too weak/i, hit["reason"])
  end

  test "active spells expire everywhere: lists, rankings fog, mana math" do
    register!
    user = User.find_by!(username: "TestMage")

    fog = Spell.create!(
      name: "Fog", description: "test fog", rank: 2, affinity: "tempest",
      mana_cost: 60, research_cost: 500, spell_type: "self",
      configuration: { stat_target: "army_size_hidden", base_magnitude: 1, duration: 14400 }
    )
    active = user.active_spells.create!(
      spell: fog, expires_at: 1.hour.from_now, stack_count: 1,
      metadata: { "stat_target" => "mana_recovery", "magnitude" => 50 }
    )

    # While live: visible in the list and fogging the rankings
    api_get "/active_spells"
    assert_equal 1, response.parsed_body["active_spells"].length

    api_get "/rankings"
    me = response.parsed_body["rankings"].find { |r| r["id"] == user.id }
    assert me["has_fog"], "fog should hide the caster while the spell is live"

    boosted_potential = user.reload.mana_generation_potential

    # Expire it — everything must let go
    active.update!(expires_at: 1.minute.ago)

    api_get "/rankings"
    me = response.parsed_body["rankings"].find { |r| r["id"] == user.id }
    refute me["has_fog"], "fog must lift once the spell expires"

    assert_operator user.reload.mana_generation_potential, :<, boosted_potential,
      "expired buffs must stop boosting mana generation"

    api_get "/active_spells"
    assert_equal 0, response.parsed_body["active_spells"].length, "expired spells must not be listed"
    assert_equal 0, user.reload.active_spells.count, "reading the list should sweep expired rows"

    api_get "/dashboard"
    assert_equal 0, response.parsed_body["active_spells"].length
  end

  test "treasury tax collects gold on valid tier and rejects bad tier" do
    register!

    api_post "/treasury/tax", { tier: "lenient" }
    assert_response :success

    api_post "/treasury/tax", { tier: "bogus" }
    assert_response :unprocessable_entity
  end
end
