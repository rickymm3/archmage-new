import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.showToasts()
  }

  showToasts() {
    // Check if bootstrap is available on window (from CDN)
    if (typeof window.bootstrap !== 'undefined') {
      const toastElList = [].slice.call(this.element.querySelectorAll('.toast'))
      const toastList = toastElList.map(function (toastEl) {
        return new window.bootstrap.Toast(toastEl, {
            autohide: true,
            delay: 5000
        })
      })
      toastList.forEach(toast => toast.show())
    } else {
        console.warn("Bootstrap JS not detected. Ensure it is loaded.")
    }
  }
}
