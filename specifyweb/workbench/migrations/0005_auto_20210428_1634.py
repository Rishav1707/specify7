# Generated by Django 2.2.10 on 2021-04-28 16:34

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('specify', '__first__'),
        ('workbench', '0004_auto_20210219_1131'),
    ]

    operations = [
        migrations.AddField(
            model_name='spdataset',
            name='createdbyagent',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='specify.Agent'),
        ),
        migrations.AddField(
            model_name='spdataset',
            name='modifiedbyagent',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='specify.Agent'),
        ),
    ]
