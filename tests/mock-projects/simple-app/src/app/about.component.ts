import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrls: [] // Can add styleUrls if needed, leave empty for now
})
export class AboutComponent implements OnInit {
  routeParamId: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.routeParamId = this.route.snapshot.paramMap.get('id');
  }
} 