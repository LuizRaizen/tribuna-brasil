from django.urls import path

from . import views

feed = "<slug:election>/<int:round_number>/<slug:office>/<slug:region>/"

urlpatterns = [
    path("elections/", views.ElectionListView.as_view(), name="elections"),
    path(
        "results/<slug:election>/<int:round_number>/",
        views.FeedListView.as_view(),
        name="result-feeds",
    ),
    path(
        "results/<slug:election>/<int:round_number>/<slug:office>/estados/",
        views.ByStateView.as_view(),
        name="result-by-state",
    ),
    path(f"results/{feed}", views.FeedResultView.as_view(), name="result-feed"),
    path(f"results/{feed}stream/", views.feed_stream, name="result-feed-stream"),
]
