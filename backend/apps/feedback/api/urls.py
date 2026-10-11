from django.urls import path

from . import views

urlpatterns = [
    path("corrections/", views.CorrectionCreateView.as_view(), name="corrections"),
]
