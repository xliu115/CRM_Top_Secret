import type { Meeting, Contact, Company } from "@prisma/client";

export type MeetingWithAttendees = Meeting & {
  attendees: {
    contactId: string;
    contact: Contact & { company: Company };
  }[];
};

export interface IMeetingRepository {
  findUpcomingByPartnerId(partnerId: string): Promise<MeetingWithAttendees[]>;
  findByPartnerId(partnerId: string): Promise<MeetingWithAttendees[]>;
  findById(
    id: string,
    partnerId: string
  ): Promise<MeetingWithAttendees | null>;
  countUpcomingByPartnerId(partnerId: string): Promise<number>;
  updateBrief(id: string, brief: string): Promise<Meeting>;
  findByContactId(contactId: string): Promise<MeetingWithAttendees[]>;
}
