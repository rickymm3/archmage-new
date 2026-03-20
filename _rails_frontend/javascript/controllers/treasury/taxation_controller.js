import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    cooldownEnd: String
  }

  static targets = ["timer", "message", "button"]

  connect() {
    if (this.hasCooldownEndValue && this.cooldownEndValue) {
      const end = new Date(this.cooldownEndValue)
      if (isNaN(end.getTime())) return
      
      this.startTimer()
    }
  }

  disconnect() {
    this.stopTimer()
  }

  startTimer() {
    this.update()
    this.timer = setInterval(() => {
      this.update()
    }, 1000)
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  update() {
    const now = new Date()
    const end = new Date(this.cooldownEndValue)
    const diff = end - now

    if (diff <= 0) {
      this.stopTimer()
      this.enable()
    } else {
      this.renderTimer(diff)
    }
  }

  renderTimer(ms) {
    const totalSeconds = Math.ceil(ms / 1000)
    let text = ""

    if (totalSeconds < 60) {
      text = `${totalSeconds}s`
    } else {
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      
      if (hours > 0) {
        text = `${hours}h ${minutes}m`
      } else {
        text = `${minutes}m`
      }
    }
    
    if (this.hasTimerTarget) {
      this.timerTarget.textContent = text
    }
    
    if (this.hasMessageTarget) {
      this.messageTarget.textContent = `Tax collectors are resting. Available in ${text}`
    }
  }
  
  enable() {
    // Reload the page to refresh server-side state (buttons enabled/disabled)
    // Using Turbo.visit to make it smooth
    window.location.reload()
  }
}
