/*
  forms.js — website form submission handler
  ===========================================
  Progressively enhances any <form data-email-form>:
    - intercepts submit, POSTs the fields to the form's action= URL
      (the zoe-form-worker Cloudflare Worker),
    - shows an inline success message on success,
    - shows an inline error (and re-enables the button) on failure.

  If JavaScript is disabled, the form still POSTs natively to the same
  Worker (which returns JSON) — no data is lost.

  Spam: a hidden honeypot field named "_gotcha" is checked here and again
  in the Worker.
*/
(function () {
  var forms = document.querySelectorAll("form[data-email-form]");

  forms.forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot — if filled, it's a bot. Silently do nothing.
      var hp = form.querySelector('input[name="_gotcha"]');
      if (hp && hp.value.trim() !== "") return;

      var btn = form.querySelector('button[type="submit"]') ||
                form.querySelector("button");
      var originalLabel = btn ? btn.innerHTML : "";

      clearStatus(form);
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = "Sending…";
      }

      fetch(form.action, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new URLSearchParams(new FormData(form)),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            showSuccess(form);
          } else {
            throw new Error((result.data && result.data.error) || "Send failed");
          }
        })
        .catch(function () {
          showError(
            form,
            "Sorry, something went wrong sending your message. Please email customersupport@zoemedical.com or call (978) 887-1410."
          );
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalLabel;
          }
        });
    });
  });

  function clearStatus(form) {
    var existing = form.querySelector(".form-status");
    if (existing) existing.remove();
  }

  function showError(form, msg) {
    clearStatus(form);
    var div = document.createElement("div");
    div.className = "form-status form-status--error";
    div.setAttribute("role", "alert");
    div.textContent = msg;
    form.insertBefore(div, form.firstChild);
  }

  function showSuccess(form) {
    var div = document.createElement("div");
    div.className = "form-success";
    div.setAttribute("role", "status");
    div.innerHTML =
      '<i class="ti ti-circle-check" aria-hidden="true"></i>' +
      "<div>" +
      "<strong>Thanks — your message is on its way.</strong>" +
      "<span>A real person in Topsfield will get back to you, usually within one business day.</span>" +
      "</div>";
    form.replaceWith(div);
  }
})();
