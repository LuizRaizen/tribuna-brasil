from django.urls import path

from . import views

urlpatterns = [
    path("candidates/", views.CandidacyListView.as_view(), name="candidates"),
    path("candidates/<str:tse_id>/", views.CandidacyDetailView.as_view(), name="candidate"),
    path("search/", views.SearchView.as_view(), name="search"),
]
