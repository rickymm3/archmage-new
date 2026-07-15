module BattleResultSerializable
  extend ActiveSupport::Concern

  private

  def serialize_battle_result(result)
    {
      outcome: result.winner.to_s,
      land_seized: result.land_seized || 0,
      verdict: result.verdict,
      attacker_army: serialize_army_summary(result.attacker_army),
      defender_army: serialize_army_summary(result.defender_army),
      log: result.log || [],
      events: result.events || []
    }
  end

  def serialize_army_summary(army)
    return nil unless army
    army.to_summary
  end
end
