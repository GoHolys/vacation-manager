<script setup lang="ts">
import type { VacationRequest } from '@/api/types';
import BaseButton from '@/components/ui/BaseButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { formatRelative } from '@/utils/dates';
import DateRange from './DateRange.vue';
import DecisionNote from './DecisionNote.vue';

defineProps<{ requests: VacationRequest[] }>();
defineEmits<{ approve: [request: VacationRequest]; reject: [request: VacationRequest] }>();
</script>

<template>
  <!-- Single root so attributes (e.g. the loading dim) apply to the whole component. -->
  <div>
    <!-- Desktop: a real table (keyboard + screen-reader friendly) -->
    <table class="hidden w-full text-left md:table">
      <thead class="border-b border-line text-sm text-ink-faint">
        <tr>
          <th scope="col" class="py-3 pr-4 pl-5 font-semibold">Requester</th>
          <th scope="col" class="px-4 py-3 font-semibold">Dates</th>
          <th scope="col" class="px-4 py-3 font-semibold">Reason</th>
          <th scope="col" class="px-4 py-3 font-semibold">Status</th>
          <th scope="col" class="py-3 pr-5 pl-4 text-right font-semibold">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="request in requests" :key="request.id" class="align-top">
          <td class="py-4 pr-4 pl-5">
            <div class="flex items-center gap-3">
              <UserAvatar :name="request.requester.name" />
              <div class="min-w-0">
                <p class="font-semibold">{{ request.requester.name }}</p>
                <p class="text-xs text-ink-faint">
                  Submitted {{ formatRelative(request.createdAt) }}
                </p>
              </div>
            </div>
          </td>
          <td class="px-4 py-4 whitespace-nowrap">
            <DateRange :start="request.startDate" :end="request.endDate" :days="request.days" />
          </td>
          <td class="max-w-xs px-4 py-4">
            <p v-if="request.reason" class="line-clamp-2 text-ink-soft" :title="request.reason">
              {{ request.reason }}
            </p>
            <p v-else class="text-ink-faint">No reason given</p>
          </td>
          <td class="px-4 py-4">
            <StatusBadge :status="request.status" />
            <DecisionNote class="mt-2 max-w-72" :request="request" />
          </td>
          <td class="py-4 pr-5 pl-4">
            <div v-if="request.status === 'pending'" class="flex justify-end gap-2">
              <BaseButton size="sm" variant="reject" @click="$emit('reject', request)"
                >Reject</BaseButton
              >
              <BaseButton size="sm" variant="approve" @click="$emit('approve', request)"
                >Approve</BaseButton
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Mobile: stacked rows -->
    <ul class="divide-y divide-line md:hidden">
      <li v-for="request in requests" :key="request.id" class="space-y-3 px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <UserAvatar :name="request.requester.name" size="sm" />
            <p class="truncate font-semibold">{{ request.requester.name }}</p>
          </div>
          <StatusBadge :status="request.status" />
        </div>
        <DateRange :start="request.startDate" :end="request.endDate" :days="request.days" />
        <p v-if="request.reason" class="text-ink-soft">{{ request.reason }}</p>
        <DecisionNote :request="request" />
        <div v-if="request.status === 'pending'" class="grid grid-cols-2 gap-2">
          <BaseButton variant="reject" @click="$emit('reject', request)">Reject</BaseButton>
          <BaseButton variant="approve" @click="$emit('approve', request)">Approve</BaseButton>
        </div>
      </li>
    </ul>
  </div>
</template>
