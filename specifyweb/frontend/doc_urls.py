from django.conf.urls import url

from . import views

urlpatterns = [
    url(r'^api/schema/$', views.api_schema),
    url(r'^api/endpoints/$', views.api_endpoints),
]
