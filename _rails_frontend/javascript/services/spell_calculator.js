// Dynamic Spell Preview (Client-side mirror of CalculateEffect)
// This should ideally be an API call to ensure syncing, but for speed we mirror logic here.
// Or we can rely on data attributes populated by Ruby.

export default class SpellCalculator {
  constructor(spellData) {
    this.config = spellData.scaling || {};
    this.baseCost = spellData.mana_cost;
    this.name = spellData.name;
  }

  calculate(amount) {
    if (!this.config.function) return "Standard Effect";

    let value = 0;
    const amountVal = parseInt(amount);

    switch (this.config.function) {
      case 'linear':
        // Value = (Invested * Rate) + Base
        const rate = parseFloat(this.config.rate || 0);
        const base = parseFloat(this.config.base || 0);
        value = (amountVal * rate) + base;
        break;

      case 'step':
        // Value = floor(Invested / CostPerUnit)
        const costPerUnit = parseInt(this.config.cost_per_unit || 100);
        value = Math.floor(amountVal / costPerUnit);
        break;

      case 'log':
        // Value = Base * log2((Invested / BaseCost) + 1)
        const baseMag = parseFloat(this.config.base_magnitude || 0);
        const baseCost = parseFloat(this.config.base_cost || this.baseCost);
        const ratio = amountVal / baseCost;
        if (ratio > -1) {
            const factor = Math.log2(ratio + 1);
            value = (baseMag * factor).toFixed(2);
        }
        break;
    }

    return this.format(value);
  }

  format(value) {
    const attr = this.config.attribute;
    const unit = this.config.unit || "";

    if (attr === 'duration') {
      const hours = value / 3600.0;
      if (hours >= 24) {
        return `${(hours / 24.0).toFixed(1)} Days`;
      } else {
        return `${hours.toFixed(1)} Hours`;
      }
    } else if (attr === 'quantity') {
      return `${parseInt(value)} Units`;
    } else {
      return `+${value} ${unit}`;
    }
  }
}
