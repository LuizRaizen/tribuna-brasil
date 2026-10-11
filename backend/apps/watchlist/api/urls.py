from django.urls import path

from . import views

urlpatterns = [
    path("watchlist/", views.WatchlistView.as_view(), name="watchlist"),
    path(
        "watchlist/<slug:kind>/<str:identifier>/",
        views.WatchlistItemView.as_view(),
        name="watchlist-item",
    ),
]
