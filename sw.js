// public/sw.js
self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'নতুন মেসেজ', body: 'আপনার একটি নতুন মেসেজ এসেছে!' };
    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});