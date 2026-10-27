from django.urls import path

from . import views

urlpatterns = [
    path("corrections/", views.CorrectionCreateView.as_view(), name="corrections"),
    path("suggestions/", views.SuggestionCreateView.as_view(), name="suggestions"),
]
