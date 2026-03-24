<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="6" md="4">
        <v-card class="text-center pa-8" elevation="8" rounded="lg">
          <v-icon size="80" color="warning" class="mb-4">mdi-alert-circle</v-icon>
          <div class="text-h2 font-weight-bold mb-2">404</div>
          <div class="text-h6 text-medium-emphasis mb-6">Страница не найдена</div>
          <v-btn
            color="primary"
            size="large"
            to="/"
            prepend-icon="mdi-home"
          >
            На главную
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
