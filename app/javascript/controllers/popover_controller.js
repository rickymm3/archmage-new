import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.initPopover()
  }

  disconnect() {
    if (this.popover) {
      this.popover.dispose()
    }
  }

  initPopover() {
    // Wait for bootstrap global if loaded via CDN
    const init = () => {
      if (window.bootstrap && window.bootstrap.Popover) {
        this.popover = new window.bootstrap.Popover(this.element)
      }
    }

    if (window.bootstrap) {
      init()
    } else {
      setTimeout(init, 100)
    }
  }
}
