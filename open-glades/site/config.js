/*
 * Open Glades — client-side config.
 * NON-SECRET ONLY. The SendGrid API key lives server-side in open-glades/server/config.json.
 * `contactEndpoint` is the path nginx reverse-proxies to the mailer service.
 */
window.OG_CONFIG = {
  contactEndpoint: '/api/contact'
};
