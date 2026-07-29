export type OrganizationStatus = "pending" | "active" | "suspended";

export type Organization = {
  id: number;
  tradeName: string;
  slug: string;
  businessType: string;
  logoKey: string | null;
  primaryColor: string;
  timezone: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
};

export type QueueService = {
  id: number;
  name: string;
  ticketPrefix: string;
  active: boolean;
  sortOrder: number;
};

export type QueueSector = {
  id: number;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  serviceIds: number[];
};

export type QueueDesk = {
  id: number;
  sectorId: number;
  sectorName: string;
  serviceIds: number[];
  name: string;
  number: number;
  active: boolean;
};

export type TicketStatus = "waiting" | "called" | "finished" | "no_show";

export type Ticket = {
  id: number;
  organizationId: number;
  serviceId: number | null;
  deskId: number | null;
  sectorId: number | null;
  sectorName: string | null;
  code: string;
  service: string;
  priority: number;
  status: TicketStatus;
  desk: number | null;
  createdAt: string;
  calledAt: string | null;
  finishedAt: string | null;
};

export type QueuePayload = {
  organization: Pick<
    Organization,
    "tradeName" | "slug" | "logoKey" | "primaryColor" | "timezone"
  >;
  services: QueueService[];
  sectors: QueueSector[];
  desks: QueueDesk[];
  tickets: Ticket[];
  waiting: number;
  served: number;
  averageMinutes: number;
};
