from django.urls import path

from . import views

urlpatterns = [
    path("notifications/", views.NotificationListView.as_view(), name="notifications"),
    path(
        "notifications/unread-count/",
        views.UnreadCountView.as_view(),
        name="notifications-unread",
    ),
    path("notifications/read/", views.MarkReadView.as_view(), name="notifications-read"),
]
