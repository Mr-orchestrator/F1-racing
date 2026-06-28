/* F1 Racing Store — free consent (orestbida CookieConsent v3).
 * Loads BEFORE utag.js so the Tealium "Consent Manager" extension can read
 * window.CookieConsent.acceptedCategory(...). On accept/change it also bridges to
 * Google Consent Mode globals and re-fires utag so GA4/Meta evaluate with consent. */
(function () {
  if (!window.CookieConsent) return; // lib failed to load — extension falls back to F1_CONSENT_DEFAULT

  function bridge() {
    var analytics = CookieConsent.acceptedCategory('analytics');
    var ads = CookieConsent.acceptedCategory('ads');
    // Google Consent Mode shape (also read by the Tealium extension as a fallback source)
    window.googleConsent = {
      analytics_storage: analytics ? 'granted' : 'denied',
      ad_storage: ads ? 'granted' : 'denied'
    };
    // Re-evaluate tags now that consent is known
    if (window.utag && typeof utag.view === 'function') {
      utag.view(window.utag_data || window.gridbox_data || {});
    }
  }

  CookieConsent.run({
    guiOptions: { consentModal: { layout: 'box', position: 'bottom left' } },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {},   // GA4 + Adobe (consent_analytics)
      ads: {}          // Meta Pixel (consent_marketing)
    },
    onFirstConsent: bridge,
    onConsent: bridge,
    onChange: bridge,
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'We value your privacy',
            description: 'We use cookies for analytics and marketing. Choose what to allow.',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            showPreferencesBtn: 'Manage preferences'
          },
          preferencesModal: {
            title: 'Consent preferences',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            savePreferencesBtn: 'Save',
            sections: [
              { title: 'Strictly necessary', description: 'Required for the site to function.', linkedCategory: 'necessary' },
              { title: 'Analytics', description: 'Google Analytics 4 and Adobe Analytics.', linkedCategory: 'analytics' },
              { title: 'Marketing', description: 'Meta (Facebook) Pixel.', linkedCategory: 'ads' }
            ]
          }
        }
      }
    }
  });
})();
