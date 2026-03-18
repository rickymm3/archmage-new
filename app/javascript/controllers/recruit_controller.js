import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    unitCost: Number,
    maxGold: Number
  }

  static targets = ["slider", "goldDisplay", "countDisplay", "submitBtn"]

  update() {
    const gold = parseInt(this.sliderTarget.value)
    const cost = this.unitCostValue
    const expected = Math.floor(gold / cost)

    this.goldDisplayTarget.textContent = gold
    this.countDisplayTarget.textContent = expected
    
    if (this.hasSubmitBtnTarget) {
        this.submitBtnTarget.disabled = expected <= 0
    }
  }
}
