import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["progressBar", "arrivedDisplay", "availableDisplay", "acceptBtn"]
  static values = {
    started: Number,   // ms timestamp
    duration: Number,  // ms
    total: Number,
    accepted: Number
  }

  connect() {
    this.update()
    this.interval = setInterval(() => this.update(), 2000)
  }

  disconnect() {
    if (this.interval) clearInterval(this.interval)
  }

  update() {
    const now = Date.now()
    const elapsed = now - this.startedValue
    const fraction = Math.min(elapsed / this.durationValue, 1.0)
    const arrived = Math.floor(this.totalValue * fraction)
    const available = Math.max(arrived - this.acceptedValue, 0)
    const percent = Math.round(fraction * 100)

    if (this.hasProgressBarTarget) {
      this.progressBarTarget.style.width = `${percent}%`
    }

    if (this.hasArrivedDisplayTarget) {
      this.arrivedDisplayTarget.textContent = `${arrived}/${this.totalValue}`
    }

    if (this.hasAvailableDisplayTarget) {
      this.availableDisplayTarget.textContent = available
    }

    if (this.hasAcceptBtnTarget) {
      this.acceptBtnTarget.disabled = available <= 0
    }

    if (fraction >= 1.0 && this.interval) {
      clearInterval(this.interval)
    }
  }
}
