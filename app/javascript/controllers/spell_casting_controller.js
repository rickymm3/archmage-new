import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    config: Object,
    minInvest: Number,
    rate: Number,
    base: Number
  }

  static targets = ["input", "output", "amount"]

  connect() {
    this.updateProjection()
  }

  updateProjection() {
    const invested = parseInt(this.inputTarget.value) || 0
    const conf = this.configValue || {}
    
    // Update displayed amount
    if (this.hasAmountTarget) {
      this.amountTarget.textContent = invested
    }

    // Default return
    let txt = "Standard Effect"
    const func = (conf.function || "").trim().toLowerCase()

    if (!func) {
      this.outputTarget.textContent = txt
      return
    }

    try {
      if (func === "linear") {
        const val = (invested * (conf.rate || 0)) + (conf.base || 0)
        const attr = (conf.attribute || "").trim().toLowerCase()
        
        if (attr === "duration") {
          const h = val / 3600
          txt = (h >= 24) ? (h/24).toFixed(1) + " Days" : h.toFixed(1) + " Hours"
        } else {
          txt = (val).toFixed(0)
        }
      } else if (func === "step") {
        const costPer = conf.cost_per_unit || 100
        const count = Math.floor(invested / costPer)
        txt = count + " " + (conf.unit || "Units")
      } else if (func === "log") {
        const baseMag = conf.base_magnitude || 0
        const baseCost = conf.base_cost || 100
        const safeCost = baseCost > 0 ? baseCost : 1
        const factor = Math.log2((invested / safeCost) + 1)
        const val = (baseMag * factor).toFixed(2)
        txt = "+" + val + " " + (conf.unit || "")
      } else {
        txt = "Unknown Scaling"
      }
    } catch(e) {
      console.error("Projection Error", e)
      txt = "Error"
    }

    this.outputTarget.textContent = txt
  }
}
